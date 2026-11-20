export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sac: {
          primary: "#E85D04",
          "primary-strong": "#E85D04",
          confirm: "#08704B",
          alert: "#D21E3A",
          ink: "#24211F",
          muted: "#6B5F57",
          canvas: "#FFFAF6",
          sand: "#F3ECE6",
          deep: "#C94E00",
          ember: "#B74700",
        },
      },
      boxShadow: {
        glass: "0 12px 38px rgba(128, 70, 28, 0.08)",
        "glass-hover": "0 18px 48px rgba(128, 70, 28, 0.13)",
        card: "0 10px 30px rgba(54, 37, 26, 0.08)",
        orange: "0 10px 24px rgba(232, 93, 4, 0.35)",
        sos: "0 14px 34px rgba(210, 30, 58, 0.45)",
        nav: "0 14px 40px rgba(54, 37, 26, 0.18)",
      },
    },
  },
  plugins: [],
};
