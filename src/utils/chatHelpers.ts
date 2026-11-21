import {
  AssistantChatContext,
  AssistantJsonReply,
  CityLocation,
  FamilyProfile,
  LocalAirQualityData,
} from "../types";

export function buildFamilySummary(familyProfile: FamilyProfile): string {
  const memberList = familyProfile.members
    .map((m) => `${m.name} (${m.ageGroup}: ${m.sensitivities.join(", ") || "none"})`)
    .join("; ");
  return `${familyProfile.householdName} (${familyProfile.homeType}, ${familyProfile.stoveType}, ${familyProfile.purifierCount} purifiers, ${familyProfile.primaryCommute}). Members: ${memberList}`;
}

export function buildAssistantContext(params: {
  selectedCity: CityLocation;
  airQuality: LocalAirQualityData | null;
  familyProfile: FamilyProfile;
  activeHackIds: string[];
  adoptedSwapIds: string[];
}): AssistantChatContext {
  const { selectedCity, airQuality, familyProfile, activeHackIds, adoptedSwapIds } = params;
  return {
    locationName: `${selectedCity.name}, ${selectedCity.country}`,
    current: airQuality?.current,
    ventilationWindow: airQuality?.ventilationWindow,
    familySummary: buildFamilySummary(familyProfile),
    activeHacks: activeHackIds,
    adoptedSwaps: adoptedSwapIds,
  };
}

export function formatAssistantJsonReply(reply: AssistantJsonReply): string {
  return [
    reply.answer,
    ...(reply.keyActions || []).map((action) => `- ${action}`),
    reply.realWorldImpact ? `Real-World Impact: ${reply.realWorldImpact}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
