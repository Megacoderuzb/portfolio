import { describe, expect, it } from "vitest";
import { MAX_RESUME_BYTES, validateResume } from "@/lib/resume";

const pdf = new TextEncoder().encode("%PDF-1.7\n...");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]);

describe("validateResume", () => {
  it("accepts a real PDF", () => {
    expect(validateResume({ size: 1000, type: "application/pdf" }, pdf)).toBeNull();
  });

  it("rejects empty, oversized, wrong MIME and fake PDFs", () => {
    expect(validateResume({ size: 0, type: "application/pdf" }, pdf)).toBe("missing");
    expect(validateResume({ size: MAX_RESUME_BYTES + 1, type: "application/pdf" }, pdf)).toBe("too_large");
    expect(validateResume({ size: 1000, type: "image/png" }, pdf)).toBe("not_pdf");
    expect(validateResume({ size: 1000, type: "application/pdf" }, png)).toBe("not_pdf"); // renamed file
  });
});
