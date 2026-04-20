import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES } from "../drizzle/schema";
import {
  PIPELINE_STAGES as CLIENT_STAGES,
  STAGE_LABELS,
  STAGE_BADGE,
  STAGE_BG,
  STAGE_HEADER,
  STAGE_DOT,
  STAGE_SHORT_LABELS,
  getNextStage,
} from "../client/src/lib/pipeline";

describe("Pipeline stages — Round 20 migration", () => {
  it("server schema includes whatsapp_group_added and not teams_invitation_sent", () => {
    expect(PIPELINE_STAGES).toContain("whatsapp_group_added");
    expect(PIPELINE_STAGES).not.toContain("teams_invitation_sent");
  });

  it("client pipeline.ts includes whatsapp_group_added and not teams_invitation_sent", () => {
    expect(CLIENT_STAGES).toContain("whatsapp_group_added");
    expect(CLIENT_STAGES).not.toContain("teams_invitation_sent");
  });

  it("STAGE_LABELS has correct label for whatsapp_group_added", () => {
    expect(STAGE_LABELS["whatsapp_group_added"]).toBe("WhatsApp Group Added");
  });

  it("STAGE_SHORT_LABELS has correct short label for whatsapp_group_added", () => {
    expect(STAGE_SHORT_LABELS["whatsapp_group_added"]).toBe("WA Group");
  });

  it("all client stage maps include whatsapp_group_added", () => {
    const maps = [STAGE_LABELS, STAGE_BADGE, STAGE_BG, STAGE_HEADER, STAGE_DOT, STAGE_SHORT_LABELS];
    for (const map of maps) {
      expect(Object.keys(map)).toContain("whatsapp_group_added");
      expect(Object.keys(map)).not.toContain("teams_invitation_sent");
    }
  });

  it("getNextStage returns whatsapp_group_added after accepted", () => {
    expect(getNextStage("accepted")).toBe("whatsapp_group_added");
  });

  it("getNextStage returns null after whatsapp_group_added (end of forward pipeline)", () => {
    expect(getNextStage("whatsapp_group_added")).toBeNull();
  });

  it("getNextStage progression is correct end-to-end", () => {
    expect(getNextStage("applied")).toBe("whatsapp_sent");
    expect(getNextStage("whatsapp_sent")).toBe("voice_note_reviewed");
    expect(getNextStage("voice_note_reviewed")).toBe("interview_scheduled");
    expect(getNextStage("interview_scheduled")).toBe("accepted");
    expect(getNextStage("accepted")).toBe("whatsapp_group_added");
    expect(getNextStage("whatsapp_group_added")).toBeNull();
  });
});
