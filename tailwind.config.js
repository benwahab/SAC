export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sac: {
          primary: "#3FAE7A",
          "primary-strong": "#2E8B68",
          confirm: "#0B6B4F",
          alert: "#D21E3A",
          ink: "#1F2A24",
          muted: "#5B6B62",
          canvas: "#F4FBF7",
          sand: "#E7F3EC",
          deep: "#1F5F45",
          ember: "#2E8B68",
        },
      },
      boxShadow: {
        glass: "0 12px 38px rgba(31, 95, 69, 0.08)",
        "glass-hover": "0 18px 48px rgba(31, 95, 69, 0.13)",
        card: "0 10px 30px rgba(31, 95, 69, 0.08)",
        orange: "0 10px 24px rgba(46, 139, 104, 0.30)",
        sos: "0 14px 34px rgba(210, 30, 58, 0.45)",
        nav: "0 14px 40px rgba(31, 95, 69, 0.16)",
      },
    },
  },
  plugins: [],
};
