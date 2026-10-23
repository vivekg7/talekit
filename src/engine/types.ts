import { z } from 'zod';

/** Identifier used for files and cross references: lower-case, digits and dashes. */
export const IdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lower-case letters, digits and dashes');

/** A drawable part: one SVG fragment, or a map of named variants (e.g. mouth shapes). */
export const PartSchema = z.union([z.string(), z.record(z.string(), z.string())]);
export type Part = z.infer<typeof PartSchema>;

export const RigNameSchema = z.enum(['humanoid', 'simple', 'quadruped']);
export type RigName = z.infer<typeof RigNameSchema>;

export const CharacterSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  rig: RigNameSchema.default('humanoid').describe(
    'humanoid: people, 200×400 box; quadruped: four-legged animals, 260×200; simple: birds, props, anything that bobs, 200×200'
  ),
  /** On-screen height in pixels at scale 1 (feet to top of the canonical box). */
  height: z.number().positive().default(220),
  /** Named colour tokens; `{token}` inside part SVG is replaced with the value. */
  colors: z.record(z.string(), z.string()).default({}),
  /**
   * The engine draws the house outline around every part, in `colors.line` if set. Turn it
   * off only for things that should not look drawn: a glow, a ghost, a reflection's ripple.
   */
  outline: z
    .boolean()
    .default(true)
    .describe('Engine-drawn outline around every part (default true); false for glows and ghosts'),
  /**
   * Follow-through: parts that swing behind the motion on a spring, so a tail trails a
   * start and flicks on a stop. Absent means the rig's own list; `[]` turns them off.
   */
  springs: z
    .array(z.string())
    .optional()
    .describe(
      "Parts that swing behind the motion on a spring (a tail, ears, a scarf). Default: the rig's (quadruped: tail, earL, earR; humanoid and simple: none); [] for none. A part the rig does not place sways instead of turning"
    ),
  /**
   * Where something carrying this character holds it (see the `attach` action), in its own
   * canonical coordinates: a lantern's handle, a balloon's string end. Default: box centre.
   */
  grip: z
    .tuple([z.number(), z.number()])
    .optional()
    .describe(
      "Where a carrier holds this prop when it is attached, [x, y] in the character's own box (a lantern's handle, the end of a balloon string). Default: the box centre"
    ),
  /**
   * A soft ground shadow under the feet. Default: on for people and animals, off for the
   * simple rig (birds, kites, things that hang in the air); set true for a prop that sits.
   */
  shadow: z
    .boolean()
    .optional()
    .describe(
      'Soft ground shadow under the feet. Default: on for humanoid and quadruped, off for the simple rig (birds and kites hang in the air); true for a prop that sits on the ground'
    ),
  parts: z.record(z.string(), PartSchema),
});
export type Character = z.infer<typeof CharacterSchema>;
export type CharacterInput = z.input<typeof CharacterSchema>;

export const AnchorSchema = z.object({
  x: z.number(),
  /** Floor point: where the character's feet go. */
  y: z.number(),
  /** Perspective multiplier applied to the character's scale when standing here. */
  scale: z.number().positive().default(1),
  floor: z
    .number()
    .optional()
    .describe(
      'On a seat anchor (y on the seat surface): the y of the floor under it, so a character sat there bends its knees to put its feet on the floor. Without it, sitting down onto a seat from where the actor stood uses that spot as the floor, and sitting where it stands is sitting on the ground'
    ),
});
export type Anchor = z.infer<typeof AnchorSchema>;

export const SceneSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  /** SVG fragment drawn behind the actors, in project pixel coordinates. */
  svg: z.string(),
  /** Optional SVG fragment drawn in front of the actors (a fence, a table edge). */
  foreground: z.string().optional(),
  /**
   * Depth layers. `far` is drawn behind `svg` and moves less than the stage when the camera
   * pans or zooms; `near` is drawn over everything and moves more. `svg` and `foreground`
   * stay at the stage's own depth, where the actors are.
   */
  far: z
    .string()
    .optional()
    .describe(
      'Distant scenery behind svg (sky, sun, far hills, a skyline) that moves less than the stage when the camera moves. It must fill the whole frame on its own, down to the bottom edge, and svg must leave the sky out so it shows through'
    ),
  near: z
    .string()
    .optional()
    .describe(
      'Things very close to the camera, drawn over the actors and the foreground (a branch across a top corner, grass at the bottom edge); moves more than the stage. Keep it to the edges of the frame'
    ),
  parallax: z
    .object({
      far: z.number().min(0).max(1).optional(),
      near: z.number().min(1).max(3).optional(),
    })
    .optional()
    .describe(
      'How fast each layer moves with the camera, the stage being 1: far 0..1 (default 0.5, 0 is fixed like the sky), near 1..3 (default 1.4)'
    ),
  /** Default floor y for the stage shortcuts left/center/right. Defaults to 0.9 * height. */
  ground: z.number().optional(),
  anchors: z.record(z.string(), AnchorSchema).default({}),
});
export type Scene = z.infer<typeof SceneSchema>;
export type SceneInput = z.input<typeof SceneSchema>;

export const PositionSchema = z.union([
  z.string(),
  z.object({ x: z.number(), y: z.number(), scale: z.number().positive().optional() }),
]);
export type Position = z.infer<typeof PositionSchema>;

export const FacingSchema = z.enum(['left', 'right']);
export type Facing = z.infer<typeof FacingSchema>;

export const VerbSchema = z.enum([
  'walk',
  'run',
  'move',
  'fly',
  'jump',
  'wave',
  'nod',
  'shake',
  'point',
  'tremble',
  'sit',
  'lie',
  'stand',
  'bounce',
  'spin',
  'appear',
  'disappear',
]);
export type Verb = z.infer<typeof VerbSchema>;

export const EmotionSchema = z.enum(['neutral', 'happy', 'sad', 'surprised', 'angry', 'scared']);
export type Emotion = z.infer<typeof EmotionSchema>;

export const CameraSchema = z.object({
  zoom: z.number().positive().default(1),
  /** World point shown at the centre of the frame. Defaults to the frame centre. */
  x: z.number().optional(),
  y: z.number().optional(),
});
export type Camera = z.infer<typeof CameraSchema>;

export const ActionSchema = z
  .object({
    /** Start time in seconds from the start of the shot. */
    t: z.number().min(0),
    /** Seconds. Each verb has a sensible default. */
    duration: z.number().positive().optional(),
    actor: IdSchema.optional(),
    do: VerbSchema.optional(),
    /**
     * Target for walk/run/move/fly: an anchor name, a stage shortcut, or {x, y}. On a `say`
     * with no `do`, the id of the actor being spoken to.
     */
    to: PositionSchema.optional().describe(
      'walk/run/move/fly/jump/sit/lie: where to (anchor, stage shortcut or {x, y}). On a say without do: the id of the actor spoken to, when the engine would guess wrong'
    ),
    /** Dialogue shown in a bubble above the actor's head; also animates the mouth. */
    say: z.string().optional(),
    bubble: z
      .enum(['speech', 'thought', 'shout'])
      .optional()
      .describe('speech (default), thought (the mouth stays still, nobody looks) or shout'),
    /** Persistent facial expression until the next emotion action. */
    emotion: EmotionSchema.optional(),
    /** Explicit part variants, e.g. { mouth: 'grin' }; persists like emotion. */
    face: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        "Force part variants, e.g. { mouth: 'grin' }, until the shot ends (a forced part does not blink or talk); '' hands a part back to the emotion"
      ),
    /** On-screen text that belongs to no actor: a title card or a narrator line. */
    caption: z.string().optional(),
    captionStyle: z.enum(['title', 'narration']).optional(),
    /** Camera target, tweened over `duration` (default 1s; 0 for a cut). */
    camera: CameraSchema.partial().optional(),
    /**
     * Carry: this actor (a prop) is held by another's hand, or a four-legged one's mouth,
     * and goes where they go until `false` lets go of it where it is.
     */
    attach: z
      .union([IdSchema, z.literal(false)])
      .optional()
      .describe(
        "Carry this actor (a prop): the id of the carrier, whose near hand (or a four-legged animal's mouth) holds it at the prop's grip; false lets go, leaving it where it is"
      ),
    /** Instant state changes. */
    set: z
      .object({
        facing: FacingSchema.optional(),
        scale: z.number().positive().optional(),
        visible: z.boolean().optional(),
        at: PositionSchema.optional(),
      })
      .optional(),
  })
  .refine(
    (a) =>
      a.do ||
      a.say ||
      a.emotion ||
      a.face ||
      a.caption ||
      a.camera ||
      a.set ||
      a.attach !== undefined,
    'an action needs at least one of: do, say, emotion, face, caption, camera, set, attach'
  )
  .refine(
    (a) => !(a.do || a.say || a.emotion || a.face || a.set || a.attach !== undefined) || a.actor,
    'actor is required for do/say/emotion/face/set/attach'
  );
export type Action = z.infer<typeof ActionSchema>;

export const CastMemberSchema = z.object({
  at: PositionSchema,
  facing: FacingSchema.default('right'),
  scale: z.number().positive().default(1),
  visible: z.boolean().default(true),
  emotion: EmotionSchema.default('neutral'),
});
export type CastMember = z.infer<typeof CastMemberSchema>;

export const ShotSchema = z.object({
  id: IdSchema,
  scene: IdSchema,
  description: z.string().optional(),
  duration: z.number().positive(),
  /** Character id -> starting placement. */
  cast: z.record(IdSchema, CastMemberSchema).default({}),
  camera: CameraSchema.default({ zoom: 1 }),
  /** Seconds of fade from black at the start / to black at the end. */
  fadeIn: z.number().min(0).default(0),
  fadeOut: z.number().min(0).default(0),
  /**
   * Seconds over which this shot dissolves in from the previous one, which carries on
   * underneath. 0 is a cut.
   */
  crossfade: z
    .number()
    .min(0)
    .default(0)
    .describe(
      "Seconds this shot dissolves in from the previous one at its start (default 0, a cut). The previous shot's last moment carries on underneath, so it needs no fadeOut"
    ),
  actions: z.array(ActionSchema).default([]),
});
export type Shot = z.infer<typeof ShotSchema>;
export type ShotInput = z.input<typeof ShotSchema>;

export const ProjectMetaSchema = z.object({
  title: z.string().min(1),
  width: z.number().int().positive().default(1280),
  height: z.number().int().positive().default(720),
  fps: z.number().int().positive().default(24),
  /** Font stack for bubbles and captions. */
  font: z
    .string()
    .default('Chalkboard SE, Comic Neue, Comic Sans MS, Arial Rounded MT Bold, sans-serif'),
});
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;
export type ProjectMetaInput = z.input<typeof ProjectMetaSchema>;

/** Everything needed to render, fully loaded in memory. */
export interface Project {
  meta: ProjectMeta;
  characters: Record<string, Character>;
  scenes: Record<string, Scene>;
  /** In playback order. */
  shots: Shot[];
}
