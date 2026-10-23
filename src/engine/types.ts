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

const ShelterSpanSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  when: z
    .string()
    .optional()
    .describe("Only while a part shows this variant (an umbrella's 'open')"),
});

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
   * The engine shades every part on the side away from the light (and lights the side
   * toward a fire). Turn it off for things that give light or have no form: a glow, a ghost.
   */
  shade: z
    .boolean()
    .default(true)
    .describe(
      'Engine-drawn shading: a darker side away from the light on every part, and a warm rim toward a fire (default true); false for glows, ghosts, flat signs'
    ),
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
  /**
   * A span this character keeps the rain and snow off (an umbrella's canopy, a hat brim),
   * in its own box, optionally only while one of its parts shows a given variant.
   */
  shelter: z
    .union([ShelterSpanSchema, z.array(ShelterSpanSchema)])
    .optional()
    .describe(
      "Keeps rain and snow off what is under it: the span from x to x + width at height y in the character's own box (an umbrella's canopy edge), or a list of them, one per variant. Drops stop on it, the ground below stays dry, and it drips at both ends"
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

const ShelterSchema = z
  .number()
  .optional()
  .describe(
    'Stage y it falls from, for a shot under a shelter (the underside of a bench seat, an awning across the top of the frame); default: the top of the frame'
  );

export const WeatherSchema = z
  .object({
    rain: z
      .object({
        amount: z
          .number()
          .min(0.1)
          .max(1)
          .default(0.5)
          .describe('0.2 a drizzle, 0.5 steady rain (default), 1 a downpour'),
        top: ShelterSchema,
      })
      .optional()
      .describe(
        'Rain falling at three depths (a haze behind the scenery, drops behind the actors, a few in front of them) with splashes on the floor around `ground`'
      ),
    snow: z
      .object({
        amount: z
          .number()
          .min(0.1)
          .max(1)
          .default(0.5)
          .describe('0.2 a few flakes, 0.5 steady snow (default), 1 a blizzard'),
        top: ShelterSchema,
      })
      .optional()
      .describe('Snowflakes drifting down at three depths, swaying as they fall'),
    wind: z
      .number()
      .min(-1)
      .max(1)
      .optional()
      .describe(
        'Wind: positive blows to the right, negative to the left, 1 a gale. It slants rain, drifts snow, smoke, sparks and leaves, moves the clouds, and from 0.3 up draws wavy gusts streaming across the frame'
      ),
    leaves: z
      .object({
        amount: z.number().min(0.1).max(1).default(0.5),
        colors: z
          .array(z.string())
          .min(1)
          .optional()
          .describe('Leaf colours; default autumn oranges, yellows and a green'),
      })
      .optional()
      .describe('Leaves tumbling down through the frame, carried sideways by the wind'),
    clouds: z
      .object({
        amount: z
          .number()
          .min(0.1)
          .max(1)
          .default(0.5)
          .describe('How much of the sky they cover: 0.2 a few, 1 overcast'),
        dark: z
          .number()
          .min(0)
          .max(1)
          .default(0)
          .describe(
            '0 white fair-weather clouds, 1 storm clouds; dark clouds also darken the sky above them and dim the whole frame a little'
          ),
        low: z
          .number()
          .optional()
          .describe('y of the bottom of the cloud band in the far layer (default 0.32 × height)'),
      })
      .optional()
      .describe(
        'Clouds drifting across the sky, with the wind or slowly to the right. Drawn in the far layer over its sky, so the scene needs `far`. From amount 0.4 up they wash the colour out of the far layer (an overcast sky), so paint the sky blue and let them grey it; clearing them brings the blue back'
      ),
    lightning: z
      .object({
        every: z
          .number()
          .min(2)
          .default(8)
          .describe('Seconds between strikes, roughly (default 8)'),
      })
      .optional()
      .describe(
        'Lightning: a bolt in the sky (behind the stage, so it needs `far`) and a flash over the frame. For a strike at a story moment use a `lightning` action instead'
      ),
    light: z
      .object({
        color: z
          .string()
          .describe("The light's colour: a night blue (#4a5a8f), a dusk orange (#e08a5a)"),
        amount: z
          .number()
          .min(0)
          .max(1)
          .default(0.5)
          .describe('How strongly it tints the characters: 0 daylight, 0.5 dusk, 0.7 night'),
      })
      .optional()
      .describe(
        'The light falling on the characters, who are drawn in daylight colours: tints them to match a night or dusk scene (draw the scene itself in those colours). A fire then lights them warmly as they come near it'
      ),
    scale: z
      .number()
      .min(0.5)
      .max(3)
      .optional()
      .describe(
        'Size of the drops, flakes and leaves, for a close-up scene drawn large: use the scale its anchors give the characters (default 1)'
      ),
    heat: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Heat haze: the far layer shimmers, as over desert sand at noon (0.5 is plenty)'),
  })
  .describe(
    'Weather the engine animates. Draw the ground yourself (wet for rain, white for snow), never the falling drops or flakes; paint a fair sky and let `clouds` grey it'
  );
export type Weather = z.infer<typeof WeatherSchema>;

export const EffectSchema = z
  .object({
    kind: z
      .enum(['fire', 'smoke', 'waterfall', 'waves', 'sun'])
      .describe(
        'fire: burning logs with flickering flames, a glow and sparks (x, y = the middle of the base on the ground). smoke: puffs rising from x, y (a chimney top, a doused fire). waterfall: water pouring from the lip at x, y (its middle) down `height`, `width` wide, foaming and misting at the bottom. waves: the sea moving between y and y + height, rows of crests and foam washing up and back at the shore line (the bottom); x and width default to the whole frame. sun: a glowing sun at x, y with slowly turning rays'
      ),
    x: z.number().optional(),
    y: z.number(),
    width: z.number().positive().optional().describe('waterfall (default 120), waves'),
    height: z
      .number()
      .positive()
      .optional()
      .describe(
        'waterfall: drop to the pool (default 300); waves: depth of the sea band (default 120)'
      ),
    size: z
      .number()
      .positive()
      .default(1)
      .describe(
        'Scale: fire 1 is a campfire about 110px tall; smoke 1 a chimney plume; sun 1 is 55px across the disc'
      ),
    color: z
      .string()
      .optional()
      .describe(
        'waterfall: the water (default #7cc6ec); waves: the crests and foam (default white); smoke: the puffs; sun: the disc'
      ),
    logs: z.boolean().default(true).describe('fire: draw the burning logs under the flames'),
    layer: z
      .enum(['far', 'stage', 'front', 'near'])
      .optional()
      .describe(
        "Which plane it belongs to, in that plane's coordinates: far (with the far scenery), stage (on the stage behind the actors), front (on the stage in front of them), near. Default far for sun, stage for the rest"
      ),
  })
  .refine((e) => e.kind === 'waves' || e.x !== undefined, 'x is required except for waves');
export type Effect = z.infer<typeof EffectSchema>;

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
  /** Weather and moving nature the engine animates, so the author never draws a frame of it. */
  weather: WeatherSchema.optional(),
  shelters: z
    .array(z.object({ x: z.number(), y: z.number(), width: z.number().positive() }))
    .default([])
    .describe(
      'Spans that keep rain and snow off what is under them, from x to x + width at height y on the stage: a roof edge, an awning, a bench seat, a tree. Drops stop on them, the ground below stays dry, and they drip at both ends'
    ),
  effects: z
    .array(EffectSchema)
    .default([])
    .describe(
      'Moving things placed in the scene that the engine animates: fire, smoke, waterfall, waves, sun. Draw what does not move (the rock face, the beach, the fire pit stones) yourself'
    ),
  lights: z
    .array(
      z.object({
        kind: z
          .enum(['sun', 'moon', 'lamp'])
          .describe(
            'sun or moon: a light in the sky (far away, its rays parallel; the higher it is, the shorter the shadows). lamp: a light on the stage among the actors (a bulb, a lantern on a post, a lit window), throwing shadows away from itself along the floor'
          ),
        x: z.number(),
        y: z.number().describe('Where the light is: the sun or moon in the sky, the bulb itself'),
        strength: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe('How dark a shadow it throws: default 1, a moon 0.55'),
        reach: z
          .number()
          .positive()
          .optional()
          .describe('lamp: how far its light goes, in scene pixels (default 700)'),
      })
    )
    .default([])
    .describe(
      'Light sources painted into the art (a sun or moon in the far layer, a bulb, a street lamp): every person, animal and grounded prop casts a shadow away from each, along the floor. A `sun` effect and every fire are lights already. A scene with none has only the soft shadow under the feet'
    ),
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
  'pickup',
  'putdown',
]);
export type Verb = z.infer<typeof VerbSchema>;

export const EmotionSchema = z.enum(['neutral', 'happy', 'sad', 'surprised', 'angry', 'scared']);
export type Emotion = z.infer<typeof EmotionSchema>;

export const CameraSchema = z.object({
  zoom: z.number().positive().default(1),
  /** World point shown at the centre of the frame. Defaults to the frame centre. */
  x: z.number().optional(),
  y: z.number().optional(),
  /**
   * Keep an actor in frame: the camera trails it, a little ahead of the way it faces, and
   * settles when it stops. Setting x or y, or an empty string, lets go of it.
   */
  follow: z
    .string()
    .optional()
    .describe(
      "Cast id the camera follows: it pans after the actor, trailing a moment behind with room ahead of it, and settles when it stops. Needs zoom above 1 (1.4 to 1.8), since the view stays inside the scene. Setting x or y, or follow: '', lets go"
    ),
});
export type Camera = z.infer<typeof CameraSchema>;
/** Where the camera is at an instant: the zoom and the world point at the frame centre. */
export type View = { zoom: number; x: number; y: number };

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
      'walk/run/move/fly/jump/sit/lie/putdown: where to (anchor, stage shortcut or {x, y}). On a say without do: the id of the actor spoken to, when the engine would guess wrong'
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
    /** Camera target, tweened over `duration` (default 1s; 0.05 for a cut). */
    camera: CameraSchema.partial().optional(),
    /**
     * Carry: this actor (a prop) is held by another's hand, or a four-legged one's mouth,
     * and goes where they go until `false` lets go of it where it is.
     */
    attach: z
      .union([IdSchema, z.literal(false)])
      .optional()
      .describe(
        "Carry this actor (a prop): the id of the carrier, whose near hand (or a four-legged animal's mouth) holds it at the prop's grip; false lets go, leaving it where it is. With do: 'pickup' the carrier stoops and takes it from where it lies; with attach false and do: 'putdown' the carrier stoops and sets it down (at `to`, else on the floor under the hand)"
      ),
    /** The weather changes, over `duration`, to this. */
    weather: WeatherSchema.optional().describe(
      'The weather turns to this over duration (default 2 s): the rain easing off, storm clouds rolling in, night falling with `light`. It replaces the weather in force; {} clears it'
    ),
    /** A lightning strike at t: a bolt in the sky and a flash over the frame. */
    lightning: z
      .literal(true)
      .optional()
      .describe(
        "A lightning strike now: a bolt in the sky (needs the scene's far layer) and a flash"
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
      a.lightning ||
      a.weather ||
      a.attach !== undefined,
    'an action needs at least one of: do, say, emotion, face, caption, camera, set, attach, lightning, weather'
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
  /** Replaces the scene's weather for this shot: the rain stops, a storm starts. */
  weather: WeatherSchema.optional().describe(
    "This shot's weather instead of the scene's (the rain has stopped, a storm is coming); {} for clear weather in a scene that has some"
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
  /** Font stack for bubbles and captions in Latin script; Devanagari always uses the bundled Baloo 2. */
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
