import { ReferenceLink } from "@/types";

export function buildReferenceLinks(dishName: string): ReferenceLink[] {
  const encoded = encodeURIComponent(dishName);
  return [
    {
      platform: "下厨房",
      title: `搜索「${dishName}」`,
      url: `https://www.xiachufang.com/search/?keyword=${encoded}`,
      type: "article",
    },
    {
      platform: "Bilibili",
      title: `搜索「${dishName} 做法」`,
      url: `https://search.bilibili.com/all?keyword=${encoded}做法`,
      type: "video",
    },
    {
      platform: "YouTube",
      title: `搜索「${dishName} recipe」`,
      url: `https://www.youtube.com/results?search_query=${encoded}+recipe`,
      type: "video",
    },
    {
      platform: "美食杰",
      title: `搜索「${dishName}」`,
      url: `https://www.meishij.net/search.php?keyword=${encoded}`,
      type: "article",
    },
  ];
}
