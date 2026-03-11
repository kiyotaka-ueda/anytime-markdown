import { defaultContent } from "./defaultContent";
import apiSpec from "./templates/apiSpec.md";
import basicDesign from "./templates/basicDesign.md";

export interface MarkdownTemplate {
  id: string;
  name: string;
  content: string;
  builtin: boolean;
}

export const BUILTIN_TEMPLATES: MarkdownTemplate[] = [
  {
    id: "welcome",
    name: "welcome",
    content: defaultContent,
    builtin: true,
  },
{
    id: "basic-design",
    name: "basicDesign",
    content: basicDesign,
    builtin: true,
  },
  {
    id: "api-spec",
    name: "apiSpec",
    content: apiSpec,
    builtin: true,
  },
];
