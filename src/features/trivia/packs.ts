import general from "./packs/general-knowledge.json";
import tech from "./packs/tech-history.json";
import geo from "./packs/geography.json";

export type ChoiceIndex = 0 | 1 | 2 | 3;

export type Question = {
  prompt: string;
  choices: [string, string, string, string];
  correct: ChoiceIndex;
};

export type QuestionPack = {
  name: string;
  questions: Question[];
};

export const BUILTIN_PACKS: QuestionPack[] = [
  general as QuestionPack,
  tech as QuestionPack,
  geo as QuestionPack,
];

export function validatePack(raw: unknown): QuestionPack | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Pack must be an object" };
  const obj = raw as Record<string, unknown>;
  const name = obj["name"];
  const questions = obj["questions"];
  if (typeof name !== "string" || name.length === 0) {
    return { error: "Pack.name must be a non-empty string" };
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    return { error: "Pack.questions must be a non-empty array" };
  }
  const validated: Question[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i] as Record<string, unknown> | undefined;
    if (!q) return { error: `Question ${i} is missing` };
    if (typeof q["prompt"] !== "string" || !q["prompt"]) {
      return { error: `Question ${i}.prompt must be a non-empty string` };
    }
    const choices = q["choices"];
    if (!Array.isArray(choices) || choices.length !== 4) {
      return { error: `Question ${i}.choices must have exactly 4 entries` };
    }
    for (let c = 0; c < 4; c++) {
      if (typeof choices[c] !== "string") {
        return { error: `Question ${i}.choices[${c}] must be a string` };
      }
    }
    const correct = q["correct"];
    if (typeof correct !== "number" || ![0, 1, 2, 3].includes(correct)) {
      return { error: `Question ${i}.correct must be 0, 1, 2, or 3` };
    }
    validated.push({
      prompt: q["prompt"] as string,
      choices: [
        choices[0] as string,
        choices[1] as string,
        choices[2] as string,
        choices[3] as string,
      ],
      correct: correct as ChoiceIndex,
    });
  }
  return { name, questions: validated };
}
