import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseSyllabus } from "@/lib/syllabus-parser";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel: allow up to 60s for the model call

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The server is missing its ANTHROPIC_API_KEY. Set it in Vercel → Project → Settings → Environment Variables." },
      { status: 500 }
    );
  }

  let body: { text?: unknown; semesterStartDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json(
      { error: "No syllabus text provided. Upload a PDF with selectable text or paste the syllabus." },
      { status: 400 }
    );
  }

  const semesterStartDate =
    typeof body.semesterStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.semesterStartDate)
      ? body.semesterStartDate
      : null;

  try {
    const result = await parseSyllabus(text, semesterStartDate);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "The server's Anthropic API key was rejected. Check ANTHROPIC_API_KEY." },
        { status: 500 }
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "We're being rate limited — wait a minute and try again." },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json(
        { error: "Couldn't reach the parsing service. Try again in a moment." },
        { status: 502 }
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "The parsing service returned an error. Try again in a moment." },
        { status: 502 }
      );
    }
    const message = error instanceof Error ? error.message : "Something went wrong while parsing.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
