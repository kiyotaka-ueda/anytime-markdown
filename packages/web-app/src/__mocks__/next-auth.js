// next-auth v5 モック: テスト環境でモジュール初期化時の fetch エラーを回避
//
// moduleNameMapper "^next-auth(.*)$" により、next-auth/react や
// next-auth/providers/* もすべてこのファイルで解決される。
// 個別テストで jest.mock("next-auth/providers/github") 等のオーバーライドは可能。

let _mockSession = null;
let _capturedConfig = null;

function NextAuth(config) {
  _capturedConfig = config;
  return {
    handlers: { GET: () => {}, POST: () => {} },
    auth: () => Promise.resolve(_mockSession),
    signIn: () => {},
    signOut: () => {},
  };
}

module.exports = {
  __esModule: true,
  default: NextAuth,

  // テストユーティリティ
  _getCapturedConfig: () => _capturedConfig,
  _setSession: (session) => { _mockSession = session; },
  _resetSession: () => { _mockSession = null; },

  // next-auth/react サブパスもこのファイルで解決される
  useSession: () => ({ data: null, status: "unauthenticated" }),
  SessionProvider: ({ children }) => children,
  signIn: () => {},
  signOut: () => {},
};
