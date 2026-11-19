export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sac: {
          primary: "#E85D04",
          "primary-strong": "#E85D04",
          confirm: "#16804A",
          alert: "#C83245",
          ink: "#24211F",
          muted: "#74675E",
          canvas: "#FBFBFB",
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
