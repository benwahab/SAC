export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sac: {
          primary: "#FFE1C8",
          "primary-strong": "#F38020",
          confirm: "#16804A",
          alert: "#C83245",
          ink: "#29231F",
          muted: "#74675E",
          canvas: "#FFF7F0",
        },
      },
      boxShadow: {
        glass: "0 12px 38px rgba(128, 70, 28, 0.08)",
        "glass-hover": "0 18px 48px rgba(128, 70, 28, 0.13)",
      },
    },
  },
  plugins: [],
};
