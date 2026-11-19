import {
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { evaluateWebAuthnRootCredentialPolicy } from "../../src/domain/webauthn-root-policy.ts";

const RP_ID = "localhost";
const ORIGIN = "http://localhost:8798";

function jsonError(message: string, status = 400): Response {
  return Response.json({ verified: false, error: message }, { status });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/options") {
      const options = await generateRegistrationOptions({
        rpName: "SAC runtime smoke test",
        rpID: RP_ID,
        userName: "runtime-test",
        userID: new Uint8Array([1, 2, 3, 4]),
        attestationType: "none",
        supportedAlgorithmIDs: [-7],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "discouraged",
          userVerification: "required",
        },
      });

      return Response.json({
        challengePresent: typeof options.challenge === "string" && options.challenge.length > 0,
        rpId: options.rp.id,
        rpName: options.rp.name,
        userVerification: options.authenticatorSelection?.userVerification,
        residentKey: options.authenticatorSelection?.residentKey,
        attachment: options.authenticatorSelection?.authenticatorAttachment,
        algorithms: options.pubKeyCredParams.map((item) => item.alg),
      });
    }

    if (url.pathname === "/verify-fixture" && request.method === "POST") {
      const input = await request.json() as {
        registration: Parameters<typeof verifyRegistrationResponse>[0]["response"];
        registrationChallenge: string;
        authentication?: Parameters<typeof verifyAuthenticationResponse>[0]["response"];
        authenticationChallenge?: string;
        invalidAuthenticationSignature?: boolean;
      };

      try {
        const registration = await verifyRegistrationResponse({
          response: input.registration,
          expectedChallenge: input.registrationChallenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          requireUserPresence: true,
          requireUserVerification: true,
          supportedAlgorithmIDs: [-7],
        });

        if (!registration.verified) {
          return jsonError("Registration verification returned false");
        }

        const info = registration.registrationInfo;
        const rootPolicy = evaluateWebAuthnRootCredentialPolicy({
          credentialDeviceType: info.credentialDeviceType,
          credentialBackedUp: info.credentialBackedUp,
        });

        let authenticationVerified: boolean | null = null;
        if (input.authentication && input.authenticationChallenge) {
          const authentication = await verifyAuthenticationResponse({
            response: input.authentication,
            expectedChallenge: input.authenticationChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: true,
            credential: info.credential,
          });
          if (!authentication.verified) {
            return jsonError("Authentication signature verification returned false");
          }
          authenticationVerified = true;
        }

        return Response.json({
          verified: true,
          credentialDeviceType: info.credentialDeviceType,
          credentialBackedUp: info.credentialBackedUp,
          userVerified: info.userVerified,
          acceptedBySacRootPolicy: rootPolicy.accepted,
          rootPolicyRejection: rootPolicy.accepted ? null : rootPolicy.reason,
          authenticationVerified,
        });
      } catch {
        return jsonError("WebAuthn fixture rejected");
      }
    }

    return new Response("not found", { status: 404 });
  },
};
