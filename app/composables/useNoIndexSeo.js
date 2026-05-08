export const useNoIndexSeo = (title) => {
  useSeoMeta({
    title,
    description: "",
    robots: "noindex, nofollow",
  });
};
