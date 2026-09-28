import { z } from "zod";
import { toWesternDigits } from "./arabicDigits";

const optionalNumber = (min: number, max: number) =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    if (typeof value === "string") return toWesternDigits(value);
    return value;
  }, z.coerce.number().finite().min(min).max(max).optional());

export const locationFieldsSchema = z
  .object({
    latitude: optionalNumber(-90, 90),
    longitude: optionalNumber(-180, 180),
    address: z.string().trim().max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Latitude and longitude must be provided together", path: ["latitude"] });
    }
  });

export function legacyCoordinates(latitude?: number, longitude?: number) {
  return latitude === undefined || longitude === undefined ? undefined : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
