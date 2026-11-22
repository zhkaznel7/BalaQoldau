export const publicCategorySlugs = ['benefits','free-courses','grants','clubs'] as const;

// Only the fixed taxonomy literals above are interpolated into SQL.
export const publicCategorySql = publicCategorySlugs.map(slug => "'"+slug+"'").join(',');
