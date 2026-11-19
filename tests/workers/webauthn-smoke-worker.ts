import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";

const RP_ID = "localhost";
const ORIGIN = "http://localhost:8798";

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
          residentKey: "required",
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

    if (url.pathname === "/reject-invalid") {
      try {
        await verifyRegistrationResponse({
          response: {
            id: "invalid",
            rawId: "invalid",
            type: "public-key",
            response: {
              clientDataJSON: "e30",
              attestationObject: "e30",
            },
            clientExtensionResults: {},
          },
          expectedChallenge: "challenge-that-must-not-match",
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
        });
        return Response.json({ rejected: false }, { status: 500 });
      } catch {
        return Response.json({ rejected: true });
      }
    }

    return new Response("not found", { status: 404 });
  },
};
