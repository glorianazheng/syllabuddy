import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ParsedSyllabusSchema, type ParsedSyllabus } from "@/lib/syllabus-schema";

export {
  ITEM_TYPES,
  DATE_CONFIDENCES,
  SyllabusItemSchema,
  ParsedSyllabusSchema,
  type SyllabusItem,
  type ParsedSyllabus,
} from "@/lib/syllabus-schema";

const MAX_SYLLABUS_CHARS = 200_000;

const SYSTEM_PROMPT = `You extract structured deadlines from college course syllabi so students can put them on a calendar.

Extract EVERY graded or schedulable item: assignments, problem sets, essays, quizzes, labs, midterms, finals, projects, presentations, participation milestones. One row per concrete deliverable — expand recurring items when the syllabus enumerates them (e.g. "Quiz 1 … Quiz 8" with dates), but if it only says "weekly quizzes" without dates, emit a single row with dateConfidence "none" and add a warning.

Dates:
- Resolve dates to YYYY-MM-DD whenever possible. If the syllabus gives a semester start date or you are given one, use it to resolve relative dates like "Week 5, Friday" (week 1 starts on the semester start date; weeks run 7 days).
- Never invent a date. If the year is missing, infer it from the semester start date when available; otherwise mark the confidence "low" and leave your best guess only if it is well grounded, else null.
- Always preserve the syllabus's original wording in dueDateRaw.

Weights:
- Report each item's share of the final grade as a percentage number. Split category weights evenly across the category's items when the syllabus does it that way ("Quizzes 20%" with 8 quizzes → 2.5 each). If splitting is unclear, put the category weight on one row and explain in notes.

Warnings are for the student reviewing your extraction: missing dates, weights that don't add up, ambiguous scheduling language. Keep each under 140 characters. Do not include generic disclaimers.`;

export async function parseSyllabus(
  syllabusText: string,
  semesterStartDate?: string | null
): Promise<ParsedSyllabus> {
  const text = syllabusText.trim();
  if (!text) {
    throw new Error("Syllabus text is empty.");
  }
  if (text.length > MAX_SYLLABUS_CHARS) {
    throw new Error(
      `Syllabus text is too long (${text.length.toLocaleString()} characters; limit ${MAX_SYLLABUS_CHARS.toLocaleString()}). Try uploading just the schedule/grading pages.`
    );
  }

  const client = new Anthropic();

  const userContent = [
    semesterStartDate ? `The semester starts on ${semesterStartDate}.` : null,
    "Extract all assignments, quizzes, labs, midterms, finals, and projects from this syllabus:",
    "",
    "<syllabus>",
    text,
    "</syllabus>",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    output_config: { format: zodOutputFormat(ParsedSyllabusSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("The model response could not be parsed. Please try again.");
  }

  return withDerivedWarnings(parsed);
}

/** Adds code-level sanity warnings on top of whatever the model reported. */
function withDerivedWarnings(parsed: ParsedSyllabus): ParsedSyllabus {
  const warnings = [...parsed.warnings];

  const totalWeight = parsed.items.reduce((sum, item) => sum + (item.weight ?? 0), 0);
  if (totalWeight > 0 && (totalWeight < 90 || totalWeight > 110)) {
    const msg = `Grade weights add up to ${Math.round(totalWeight)}% — double-check the weights column.`;
    if (!warnings.some((w) => w.includes("add up") || w.includes("sum"))) {
      warnings.push(msg);
    }
  }

  if (parsed.items.length === 0) {
    warnings.push("No assignments or exams were found — is this the right document?");
  }

  return { ...parsed, warnings };
}
