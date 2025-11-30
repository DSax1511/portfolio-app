export const formatDateTick = (value: string | number) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });

export const formatDateTickShort = (value: string | number) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
