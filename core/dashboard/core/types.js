import { z } from "zod";
export const ExperimentType = z.enum([
    "boost",
    "pin",
    "softCategoryBoost",
    "personalizationWeight",
    "filterTag",
    "categoryRule",
]);
export const ExperimentStatus = z.enum([
    "proposed",
    "approved",
    "running",
    "paused",
    "completed",
    "promoted",
    "rejected",
    "killed",
]);
// Config patch applied to the tenant store object for a variant arm.
// Shapes by experiment type — a patch may combine keys when types compose.
const BaseArmPatch = z
    .object({
    demotedProductIds: z.array(z.string().min(1).max(150)).max(100).optional(),
    productNotes: z.array(z.object({productId:z.string().min(1),text:z.string().min(1).max(120)}).strict()).max(20).optional(),
    productBundles: z.array(z.object({productIds:z.array(z.string().min(1)).min(2).max(4),title:z.string().min(1).max(100)}).strict()).max(4).optional(),
    excludedProductIds: z.array(z.string().min(1).max(150)).max(100).optional(),
    productBoosts: z.record(z.string(), z.number().int().min(0).max(3)).optional(),
    pinnedResults: z
        .array(z.object({
        query: z.string().min(1),
        productIds: z.array(z.union([z.string(), z.number()])).min(1),
        enabled: z.boolean().default(true),
    }))
        .optional(),
    softCategoriesBoost: z.record(z.string(), z.number()).optional(),
    profileBoostMultiplier: z.number().min(0).max(5).optional(),
    // Rule-based cross-category association: "when this experiment's targeted
    // query fires, also surface products from these categories" — e.g. show
    // cognac alongside brandy on query "brandy". Resolved dynamically per
    // request by the dashboard-server hook (piggybacks on the existing
    // pinned-results mechanism), not a static product list.
    categoryAssociation: z
        .object({
        softCategories: z.array(z.string()).default([]),
        categories: z.array(z.string()).default([]),
        limit: z.number().int().min(1).max(20).default(5),
    })
        .refine((v) => v.softCategories.length > 0 || v.categories.length > 0, {
        message: "categoryAssociation needs at least one softCategory or category",
    })
        .optional(),
})
    .strict();
export const ArmPatch=BaseArmPatch.extend({queryPatches:z.array(z.object({query:z.string().min(1).max(200),patch:BaseArmPatch}).strict()).max(20).optional()});
export const Arm = z.object({
    key: z.string().min(1), // "control" | "v1" | ...
    weight: z.number().positive(), // relative weight among arms
    patch: ArmPatch.default({}), // control arm must be {}
});
// Time-of-day condition, e.g. 22:00–06:00 wraps past midnight. Shared by
// experiments (targeting) and permanent rules (condition) — same evaluator
// on both sides (assignment.ts here, experiments-hook.mjs in dashboard-server).
export const TimeWindow = z.object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
    timezone: z.string().default("Asia/Jerusalem"),
});
export const Targeting = z.object({
    mode: z.enum(["all", "queryMatch"]),
    patterns: z.array(z.string()).default([]),
    matchType: z.enum(["exact", "contains"]).default("contains"),
    timeWindow: TimeWindow.optional(),
});
export const Guardrails = z.object({
    minSessionsPerArm: z.number().int().positive().default(1000),
    maxDurationDays: z.number().int().positive().default(21),
    maxConversionDropPct: z.number().positive().default(20),
});
export const ExperimentInput = z.object({
    tenantApiKey: z.string().min(1),
    dbName: z.string().min(1),
    name: z.string().min(1),
    hypothesis: z.string().min(1),
    source: z.enum(["agent", "manual", "nl"]).default("manual"),
    proposalId: z.string().optional(),
    type: ExperimentType,
    targeting: Targeting,
    layer: z.string().default("default"),
    arms: z.array(Arm).min(2),
    trafficPct: z.number().min(1).max(100).default(100),
    guardrails: Guardrails.prefault({}),
    schedule: z
        .object({ startAt: z.coerce.date().optional(), endAt: z.coerce.date().optional() })
        .default({}),
});
export const ProposalStatus = z.enum(["pending", "approved", "rejected", "expired"]);
// Catalog enrichment is deliberately separate from experiments: changing a
// product document is global state and would contaminate an A/B control arm.
export const CatalogFilterChange = z.object({
    filter: z.string().trim().min(2).max(80),
    productIds: z.array(z.string().min(1)).min(1).max(500),
    rationale: z.string().min(20),
});
// Permanent, always-on rules ("boost all red wines 22:00-06:00", "always
// show whiskey on 'bourbon'") — distinct from experiments because they have
// no control group and no measurement; they just apply to 100% of matching
// traffic until disabled. Condition reuses Targeting (query match and/or
// time window); patch reuses the exact same ArmPatch shapes as experiments.
export const RuleInput = z.object({
    tenantApiKey: z.string().min(1),
    dbName: z.string().min(1),
    name: z.string().min(1),
    naturalLanguageText: z.string().min(1),
    condition: Targeting,
    patch: ArmPatch,
});
export const RuleStatus = z.enum(["active", "disabled"]);
