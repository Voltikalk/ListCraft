import type { ListingInput, ListingOutput } from "@/lib/listing-schema";

/**
 * Пример для лендинга, кнопки «Заполнить примером» и демо-режима без API-ключа.
 *
 * DEMO_LISTING — НЕ ответ ИИ: текст составлен вручную, чтобы показать формат результата.
 * Он не зависит от того, что ввёл пользователь, и в интерфейсе всегда помечается
 * как пример. Все факты в нём взяты только из EXAMPLE_INPUT.
 */
export const EXAMPLE_INPUT: ListingInput = {
  productName: "Плёночный зеркальный фотоаппарат Зенит-Е (35 мм) с объективом Гелиос-44-2",
  brand: "Зенит",
  condition: "used_good",
  dimensions: "Объектив 58 мм, f/2",
  color: "Чёрный с серебристым",
  material: "",
  details:
    "1985 года выпуска. Затвор срабатывает на всех выдержках, экспонометр не проверял. " +
    "На корпусе мелкие потёртости, стёкла объектива без царапин. В комплекте родной кожаный чехол.",
};

export const DEMO_LISTING: ListingOutput = {
  title: "Zenit-E 35mm Film SLR Camera with Helios-44-2 58mm f/2 Lens, 1985, Leather Case",
  description:
    "Zenit-E 35mm film SLR camera with a Helios-44-2 58mm f/2 lens, made in 1985. Black and silver finish.\n\n" +
    "The shutter fires at all speeds. The light meter has not been tested, so please treat it as untested. " +
    "The body shows minor scuffs; the lens glass is free of scratches.\n\n" +
    "Comes with the original leather case.",
  confirmed_specs: [
    { name: "Brand", value: "Zenit", source: "seller" },
    { name: "Model", value: "Zenit-E", source: "seller" },
    { name: "Type", value: "35mm film SLR camera", source: "seller" },
    { name: "Lens", value: "Helios-44-2 58mm f/2", source: "seller" },
    { name: "Color", value: "Black/Silver", source: "seller" },
    { name: "Year of Manufacture", value: "1985", source: "seller" },
    { name: "Condition", value: "Used, good condition", source: "seller" },
    { name: "Included", value: "Original leather case", source: "seller" },
  ],
  keywords: [
    "zenit-e",
    "zenit camera",
    "helios-44-2",
    "helios 58mm f2",
    "35mm film camera",
    "film slr camera",
    "vintage film camera",
  ],
  missing_details: [
    "Проверьте экспонометр — покупатели часто спрашивают, работает ли он",
    "Есть ли передняя и задняя крышки объектива",
    "Серийные номера корпуса и объектива (их ищут коллекционеры)",
    "Добавьте фото — по нему ИИ точнее опишет внешний вид",
  ],
};
