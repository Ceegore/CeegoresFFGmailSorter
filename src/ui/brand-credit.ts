import { BRAND_CREDIT } from "@/shared/constants";

export function renderBrandCredit(): HTMLParagraphElement {
  const credit = document.createElement("p");
  credit.className = "giso-brand-credit";
  credit.dataset["testid"] = "brand-credit";
  credit.textContent = BRAND_CREDIT;
  return credit;
}
