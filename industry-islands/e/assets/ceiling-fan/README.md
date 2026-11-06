# Ceiling fan geometry

Locally tessellated from the supplied CAD assembly. Public metadata contains neutral mesh labels and no source file paths, CAD part names, or author data.

- Units: millimeters. Y points upward; rotor axis is `[0, 1, 0]` through `[0, 0, 0]`.
- Five source blades. `bladeSweepDiameter` measures the complete swept envelope including end fins, independently of support hardware.
- `rotor: true`: blade assembly, end fins, and blade attachment hub. Motor bottom housing, shaft, downrod, mounting clamps, and support hardware remain fixed.
- `role` enables presentation color overrides; colors retain the supplied CAD appearance.
- `installationTopY` is the highest fastener tip. `mountContactY` is the top of the folded clamp body; fastener tips extend above this plane.
- `mountBounds` includes mounting ears and fasteners. `clampBounds` describes the central clamp body and base plate, excluding protruding bolts and lower ears.
- Hidden motor internals and fasteners smaller than 35 mm were omitted. The mounting clamp profiles, holes, brackets, main bolts, motor housing, blade extrusion, and end fins remain source geometry.
- Binary buffers: Float32 positions and normals, Uint16 indices. Read the declared metadata type per buffer.

Geometry verification: finite positions/normals, index ranges, buffer lengths, total triangle count, source assembly classification, and an orthographic geometry preview were checked. No application JavaScript is included here.
