/**
 * Marks the entity whose Position is the centre of the viewport.
 *
 * The camera used to be a resource hanging off RenderingResources. Making it an
 * entity is what lets anything aim it: there is now a handle to jump, and a
 * Position component that every existing movement system already knows how to
 * drive.
 *
 * Exactly one entity may carry this. FindCameraEntity throws on a second rather
 * than silently picking one, because two cameras present as the view
 * intermittently snapping somewhere else — far harder to trace than a throw on
 * the frame the second one was created.
 */
export class IsCamera {}
