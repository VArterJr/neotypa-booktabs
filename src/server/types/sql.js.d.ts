declare module 'sql.js' {
  export interface Statement {
    bind(values?: any[]): void;
    step(): boolean;
    getAsObject(): any;
    run(values?: any[]): void;
    free(): void;
  }

  export interface Database {
    exec(sql: string): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
  }

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}
