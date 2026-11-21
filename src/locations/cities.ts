export interface CityOption { id: string; name: string; stateCode: string }
export const cityLabel = (city: CityOption) => `${city.name}/${city.stateCode}`;
function fold(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function matchesCity(city: CityOption, query: string) {
  const label = fold(cityLabel(city));
  return fold(query).split(/\s+/).every(word => label.includes(word));
}
