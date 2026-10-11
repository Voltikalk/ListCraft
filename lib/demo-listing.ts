import type { ListingInput, ListingOutput, Market } from "@/lib/listing-schema";

/**
 * Пример для лендинга, кнопки «Заполнить примером» и демо-режима без API-ключа.
 *
 * DEMO_LISTINGS — НЕ ответы ИИ: тексты составлены вручную, чтобы показать формат результата.
 * Они не зависят от того, что ввёл пользователь, и в интерфейсе всегда помечаются
 * как пример. Все факты в них взяты только из EXAMPLE_INPUT.
 */
export const EXAMPLE_INPUT: Omit<ListingInput, "market"> = {
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

const MISSING_DETAILS = [
  "Проверьте экспонометр — покупатели часто спрашивают, работает ли он",
  "Есть ли передняя и задняя крышки объектива",
  "Серийные номера корпуса и объектива (их ищут коллекционеры)",
  "Добавьте фото — по нему ИИ точнее опишет внешний вид",
];

export const DEMO_LISTINGS: Record<Market, ListingOutput> = {
  global: {
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
    missing_details: MISSING_DETAILS,
  },
  ru: {
    title: "Фотоаппарат Зенит-Е с объективом Гелиос-44-2",
    description:
      "Плёночный зеркальный фотоаппарат Зенит-Е (35 мм) с объективом Гелиос-44-2 58 мм f/2. " +
      "Год выпуска — 1985. Цвет — чёрный с серебристым.\n\n" +
      "Затвор срабатывает на всех выдержках. Экспонометр не проверялся. " +
      "На корпусе мелкие потёртости, стёкла объектива без царапин.\n\n" +
      "В комплекте родной кожаный чехол.",
    confirmed_specs: [
      { name: "Бренд", value: "Зенит", source: "seller" },
      { name: "Модель", value: "Зенит-Е", source: "seller" },
      { name: "Тип", value: "Плёночный зеркальный фотоаппарат", source: "seller" },
      { name: "Формат", value: "35 мм", source: "seller" },
      { name: "Объектив", value: "Гелиос-44-2 58 мм f/2", source: "seller" },
      { name: "Цвет", value: "Чёрный с серебристым", source: "seller" },
      { name: "Год выпуска", value: "1985", source: "seller" },
      { name: "Состояние", value: "Б/у, хорошее", source: "seller" },
      { name: "Комплектация", value: "Кожаный чехол", source: "seller" },
    ],
    keywords: [
      "зенит е",
      "фотоаппарат зенит",
      "гелиос 44-2",
      "пленочный фотоаппарат",
      "зеркальный пленочный фотоаппарат",
      "фотоаппарат 35 мм",
      "объектив гелиос 58 мм",
    ],
    missing_details: MISSING_DETAILS,
  },
};
