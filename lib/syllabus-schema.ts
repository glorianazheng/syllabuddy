// Client-safe schema and types for parsed syllabi. Keep this file free of
// server-only imports (the Anthropic SDK lives in lib/syllabus-parser.ts).
import { z } from "zod";

export const ITEM_TYPES = [
  "assignment",
  "quiz",
  "lab",
  "midterm",
  "final",
  "project",
  "other",
] as const;

export const DATE_CONFIDENCES = ["none", "low", "medium", "high"] as const;

export const SyllabusItemSchema = z.object({
  title: z.string().describe("Short name of the item, e.g. 'Problem Set 3' or 'Midterm 1'"),
  type: z.enum(ITEM_TYPES),
  dueDate: z
    .string()
    .nullable()
    .describe("Resolved due date as YYYY-MM-DD, or null if it cannot be determined"),
  dueDateRaw: z
    .string()
    .nullable()
    .describe(
      "The exact date wording from the syllabus, e.g. 'Week 5, Friday' or 'Oct 14' — null only if the syllabus gives no date language at all"
    ),
  dateConfidence: z.enum(DATE_CONFIDENCES).describe(
    "high = explicit unambiguous date in the syllabus; medium = inferred (e.g. from week number + semester start date); low = partial or ambiguous (e.g. month only, missing year, 'TBD mid-October'); none = no date information"
  ),
  weight: z
    .number()
    .nullable()
    .describe(
      "Grade weight as a percentage of the final grade (e.g. 15 for 15%). If a category weight is split evenly across N items, divide it. Null if unknown."
    ),
  notes: z
    .string()
    .nullable()
    .describe("Anything a student would want to know: 'lowest quiz dropped', 'due 11:59pm', etc."),
});

export const ParsedSyllabusSchema = z.object({
  courseName: z.string().nullable().describe("Course title, e.g. 'Introduction to Psychology'"),
  courseCode: z.string().nullable().describe("Course code, e.g. 'PSYC 101'"),
  items: z.array(SyllabusItemSchema),
  warnings: z
    .array(z.string())
    .describe(
      "Short human-readable caveats about the extraction, e.g. 'Grade weights sum to 90%, the syllabus may list an ungraded component' or 'Quiz dates say \\'weekly\\' — only the first is listed'"
    ),
});

export type SyllabusItem = z.infer<typeof SyllabusItemSchema>;
export type ParsedSyllabus = z.infer<typeof ParsedSyllabusSchema>;
