declare module "jspdf" {
  interface jsPDFOptions {
    orientation?: "portrait" | "landscape";
    unit?: string;
    format?: string | number[];
  }
  class jsPDF {
    constructor(options?: jsPDFOptions);
    getPageWidth(): number;
    setFontSize(size: number): this;
    text(text: string | string[], x: number, y: number): this;
    splitTextToSize(text: string, maxWidth: number): string[];
    addPage(): this;
    save(name?: string): void;
    output(type: "arraybuffer"): ArrayBuffer;
  }
  export { jsPDF };
}
