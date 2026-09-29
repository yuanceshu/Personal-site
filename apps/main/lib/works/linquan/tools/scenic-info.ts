import { scenicSpots, scenicSpotMap, faqs } from "@/lib/works/linquan/data";
import { getScenicInfoInputSchema } from "@/lib/works/linquan/schemas/domain";
import { getScenicInfoOutputSchema } from "@/lib/works/linquan/schemas/tool";

export function getScenicInfo(rawInput: unknown) {
  const input = getScenicInfoInputSchema.parse(rawInput);
  if (input.spotId) {
    const spot = scenicSpotMap[input.spotId];
    if (!spot) throw new Error("没有找到这个景点");
    return getScenicInfoOutputSchema.parse({ type: "spot" as const, spot, relatedFaqs: faqs.filter((faq) => faq.tags.some((tag) => spot.description.includes(tag))) });
  }
  const query = input.query?.toLowerCase() ?? "";
  const spots = scenicSpots.filter((spot) => `${spot.name}${spot.description}${spot.tags.join("")}${spot.highlights.join("")}`.toLowerCase().includes(query));
  const faqMatches = faqs.filter((faq) => `${faq.question}${faq.answer}${faq.tags.join("")}`.toLowerCase().includes(query));
  return getScenicInfoOutputSchema.parse({ type: "search" as const, spots, faqs: faqMatches });
}
