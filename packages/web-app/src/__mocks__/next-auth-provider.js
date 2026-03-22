// next-auth/providers/* モック
// GitHub 等の OAuth プロバイダーをダミーオブジェクトとして返す
module.exports = {
  __esModule: true,
  default: (config) => ({ id: "github", name: "GitHub", type: "oauth", ...config }),
};
