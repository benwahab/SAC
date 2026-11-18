export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sac: {
          primary: "#CDEBD3",
          "primary-strong": "#4F9565",
          confirm: "#167A49",
          alert: "#C83245",
          ink: "#20372B",
          muted: "#627568",
          canvas: "#F1F8F2",
        },
      },
      boxShadow: {
        glass: "0 12px 38px rgba(43, 92, 58, 0.08)",
        "glass-hover": "0 18px 48px rgba(43, 92, 58, 0.13)",
      },
    },
  },
  plugins: [],
};
