import type { IO } from "../../../../../core/types";

type Finding = {
  section: string;
  message: string;
  remediation?: string;
};

/**
 * collects the results of all doctor checks: each check logs
 * immediately (progressive output like `project setup`) and problems
 * are repeated in the final summary together with the command that
 * heals them. The report itself never mutates anything — doctor
 * diagnoses, setup heals.
 */
export class DoctorReport {
  private passed = 0;
  private readonly warnings: Finding[] = [];
  private readonly problems: Finding[] = [];
  private currentSection = "";

  constructor(private readonly io: IO) {}

  section(title: string) {
    this.currentSection = title;
    this.io.log("");
    this.io.log("🩺 " + title);
  }

  ok(message: string) {
    this.passed++;
    this.io.log("  ✅ " + message);
  }

  warn(message: string, remediation?: string) {
    this.warnings.push({ section: this.currentSection, message, remediation });
    this.io.log("  ⚠️ " + message);
    if (remediation) this.io.log("     ↳ " + remediation);
  }

  fail(message: string, remediation?: string) {
    this.problems.push({ section: this.currentSection, message, remediation });
    this.io.log("  ❌ " + message);
    if (remediation) this.io.log("     ↳ " + remediation);
  }

  get hasProblems(): boolean {
    return this.problems.length > 0;
  }

  summarize() {
    const { io } = this;
    io.log("");
    io.log(
      "==================================================================================",
    );
    io.log(
      `🩺 doctor summary: ${this.passed} checks passed, ` +
        `${this.warnings.length} warnings, ${this.problems.length} problems`,
    );
    if (!this.hasProblems) {
      io.log("");
      io.log("everything looks healthy 😻");
      return;
    }
    io.log("");
    for (const { section, message, remediation } of this.problems) {
      io.log(`❌ [${section}] ${message}`);
      if (remediation) io.log(`   ↳ ${remediation}`);
    }
  }
}
