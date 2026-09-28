declare module '@marsaud/smb2' {
  interface SMB2Options {
    share: string
    domain?: string
    username?: string
    password?: string
    port?: number
    autoCloseTimeout?: number
    debug?: boolean
  }

  interface SMB2Stats {
    size: number
    mtime: Date
    isDirectory(): boolean
    isFile(): boolean
  }

  class SMB2 {
    constructor(options: SMB2Options)
    readdir(path: string): Promise<string[]>
    readFile(path: string, options?: string): Promise<Buffer>
    createReadStream(path: string, options?: Record<string, unknown>): NodeJS.ReadableStream
    writeFile(path: string, data: Buffer | string): Promise<void>
    createWriteStream(path: string, options?: Record<string, unknown>): NodeJS.WritableStream
    mkdir(path: string): Promise<void>
    rmdir(path: string): Promise<void>
    unlink(path: string): Promise<void>
    stat(path: string): Promise<SMB2Stats>
    exists(path: string): Promise<boolean>
    disconnect(): void
  }

  export = SMB2
}
