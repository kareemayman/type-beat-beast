// The contract between the React app and the preload: everything React is allowed to use is listed here.
export interface Api {
  versions: {
    electron: string
    chrome: string
    node: string
  }
}
