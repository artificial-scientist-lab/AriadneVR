import { LineMaterial } from "../lines/LineMaterial.js";
import { LineGeometry } from "../lines/LineGeometry.js";
import { Line2 } from "../lines/Line2.js";

// global variable containters shared by all edge components

var indicatorGeo = new THREE.OctahedronGeometry(0.002, 0); //new THREE.SphereGeometry(0.002, 8, 8);
var indicatorMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
var indicatorMesh = new THREE.Mesh(indicatorGeo, indicatorMat);

var edgeGeo = new LineGeometry();
var edgeMat = new LineMaterial({
	color: 0xffffff,
	linewidth: 0.003,
	vertexColors: true,
	dashed: false,
	gapSize: 0,
	opacity: 1,
	transparent: true,
});

// variable containers for the curve interpolation
const lineSegmentCount = 5; //line segments per edge
var Apos = new THREE.Vector3(); //edge start coordinate
var Bpos = new THREE.Vector3(); //edge end coordinate
var normEdge = new THREE.Vector3(); //normalised vector pointing from Apos to Bpos
var midpoint = new THREE.Vector3(); //midpoint between Apos and Bpos
var midpointCorrection = new THREE.Vector3(0, 0, 1); //vector perp. to normEdge (angle set in getCurveAnchors())
var curve = new THREE.CatmullRomCurve3(); //interpolated curve object for the edge geometry
var order_reversed = false; // flag for reversing the order of the edge ends

/* Class: edge-component
	Adds a colored, weighted edge to the graph. Edges automatically update their geometry when vertices are moved.
	Multiple edge components are allowed on a single element(graph). 

	Dependencies: 
		graph-component - requires the graph component on this element EXCEPT for the floating edges during drawing.
		vertex-component - requires the vertex component on children elements (vertices)

*/
AFRAME.registerComponent("edge", {
	/* Property: schema

		Parameters:

			graph - graph element selector
			numId - numerical id of the edge
			edgeConfig - array of vertex numIds and edge colors (vertex1, vertex2, color1, color2)
			siblingConfig - array of sibling count, sibling index and sibling names (siblingCount, siblingIndex, [siblingNames])
			phase - phase of the edge in units of pi
			amplitude - amplitude of the edge

	*/
	schema: {
		graph: { type: "selector" },
		numId: { type: "number" },
		edgeConfig: { type: "array" },
		siblingConfig: { type: "array", default: [0, 0, [""]] }, // [siblingCount, siblingIndex, [siblingNames]]

		phase: { type: "number", default: 0 },
		amplitude: { type: "number", default: 1 },
	},

	/* Property: Attributes
	  	this.graph - graph-component of the graph element, set by init()
		this.line - line object3D of the edge, set by drawEdge()
		this.indicator - indicator object3D of the edge, set by drawEdge() if applicable
		this.edgeObjGroup - group object3D of the edge, set by drawEdge() containing line and indicator
		this.endsGrabbed - flag for updating the edge on tick
	*/

	multiple: true,

	// Group: lifecycle-handlers
	// ----------------------------------------------

	/*Constructor: init
		Initialises the component.
		Sets the this. endsGrabbed flag to false and the graph component.
		Update the this.data.edgeConfig of the edge to contain pointers to elements/components instead of numIds.
	*/
	init: function () {
		this.endsGrabbed = false;
		this.graph = this.data.graph.components.graph;

		if (this.el.id == "floatingEdge") {
			this.updateConfig(
				document.querySelector("#rightHandColliderSphere").components.geometry
			);
		} else {
			this.updateConfig(undefined);
		}
		//	this.tick = AFRAME.utils.throttleTick(this.tick, 60, this); // throttle tick to 60fps
		// this leads to unpleasent jittering if the fps is below 60 so I disabled it for now
	},

	/*Function: update
		Updates the component when the data changes.
		Updates the this.data.edgeConfig of the edge to contain pointers to elements/components instead of numIds.
		Updates the edge geometry.
	*/
	update: function (oldData) {
		if (oldData.graph != this.data.graph) {
			this.graph = this.data.graph.components.graph;
		}

		if (oldData.edgeConfig != this.data.edgeConfig) {
			if (this.el.id == "floatingEdge") {
				this.updateConfig(
					document.querySelector("#rightHandColliderSphere").components.geometry
				);
			} else {
				this.updateConfig(undefined);
			}
		}

		this.drawEdge(); //redraw the edge
	},

	/*Function: remove
		executed when the component is removed
		removes the edge from the graph data and updates numIds and siblingConfigs of the remaining edges
		cleans up the 3d object
	*/
	remove: function () {
		if (this.el.id != "floatingEdge") {
			const graphData = this.graph.graphData;
			graphData.graph.edges.forEach((e) => {
				if (e.data.numId > this.data.numId) {
					let edgeObj = this.el.object3D.getObjectByName("edge" + e.data.numId);
					if (edgeObj != undefined) {
						// safeguard against trying to remove an edge that has already been removed
						edgeObj.name = "edge" + (e.data.numId - 1);
						e.data.numId -= 1;
					}
				}
			});
			graphData.graph.edges = graphData.graph.edges.filter((e) => e != this);
			//update the vertex relations
			graphData.graph.vertices.forEach((v) => {
				v.data.edges = v.data.edges.filter((e) => e != this);
				if (this.siblingCount > 0) {
					v.data.neighbours = v.data.neighbours.filter(
						(n) => n != this.data.edgeConfig[0] || n != this.data.edgeConfig[1]
					);
				}
			});
		}

		this.edgeObjGroup;
		this.el.object3D.remove(this.edgeObjGroup);

		cleanUpObject(this.edgeObjGroup);

		//update siblings
		this.data.siblingConfig[2].forEach((edgeArgID) => {
			let edge = this.el.components[edgeArgID];
			if (edge != undefined) {
				// safeguard against trying to draw an edge that has already been drawn, possibly redundant
				edge.data.siblingConfig[0] -= 1;
				if (edge.data.siblingConfig[1] > this.data.siblingConfig[1]) {
					edge.data.siblingConfig[1] -= 1;
				}
				edge.data.siblingConfig[2].splice(this.data.siblingConfig[1], 1);

				if (edge.oldData != undefined) {
					//another safeguard against trying to update an edge that has already been removed
					edge.update(edge.oldData);
				}
			}
		});
	},

	/*Function: tick

		tick-handler, executed every frame.
		updates the edge geometry if the edge ends are grabbed
	*/
	tick: function () {
		if (this.endsGrabbed) {
			this.moveEdge();
		}
	},

	// Group: methods
	// ----------------------------------------------

	/*method: getCurveAnchors
		Computes the 3 pooint (start, mid, end) Geometry of the edge from vertex positions ans sibling information.

		Returns:
			[start, mid, end] - array of THREE.Vector3 objects

	*/
	getCurveAnchors: function () {
		// get the coordinates of the edge ends
		// Apos is always the vertex with the lower index
		// this ensures tha drawing direction has no influence on the edge geometry
		if (this.el == this.data.edgeConfig[1].el.parentNode) {
			if (
				this.data.edgeConfig[1].data.numId < this.data.edgeConfig[0].data.numId
			) {
				Apos.copy(this.data.edgeConfig[1].el.object3D.position);
				Bpos.copy(this.data.edgeConfig[0].el.object3D.position);
				order_reversed = true;
			} else {
				Apos.copy(this.data.edgeConfig[0].el.object3D.position);
				Bpos.copy(this.data.edgeConfig[1].el.object3D.position);
				order_reversed = false;
			}
		} else {
			if (
				this.data.edgeConfig[1].data.numId < this.data.edgeConfig[0].data.numId
			) {
				this.data.edgeConfig[1].el.object3D.getWorldPosition(Apos);
				this.data.edgeConfig[0].el.object3D.getWorldPosition(Bpos);
				order_reversed = true;
			} else {
				this.data.edgeConfig[0].el.object3D.getWorldPosition(Apos);
				this.data.edgeConfig[1].el.object3D.getWorldPosition(Bpos);
				order_reversed = false;
			}
		}

		normEdge.subVectors(Bpos, Apos).normalize();

		midpoint.addVectors(
			Apos,
			normEdge.multiplyScalar(0.5 * Apos.distanceTo(Bpos))
		);

		if (this.data.siblingConfig[0] > 0) {
			midpointCorrection.set(0, 0, 1); //reset midpointCorrection

			if (midpointCorrection.equals(normEdge)) {
				midpointCorrection.set(1, 0, 0);
			}
			midpointCorrection
				.projectOnPlane(normEdge)
				.normalize()
				.multiplyScalar(0.01);

			let rotations = [];
			for (let i = 0; i < this.data.siblingConfig[0] + 1; i++) {
				rotations.push((i * 2 * Math.PI) / (this.data.siblingConfig[0] + 1));
			}

			midpoint.add(
				midpointCorrection.applyAxisAngle(
					normEdge.normalize(),
					rotations[this.data.siblingConfig[1]]
				)
			);
		}
		return order_reversed ? [Bpos, midpoint, Apos] : [Apos, midpoint, Bpos]; //return the edge end coordinates and the midpoint orderd correctly
	},

	/*method: moveEdge
		updates the edge geometry line segment by segment when edge ends are grabbed
	*/
	moveEdge: function () {
		// greatly inspired by West Langley's answer on stackoverflow https://stackoverflow.com/questions/62416963/three-js-rope-cable-effect-animating-thick-lines
		curve.points = this.getCurveAnchors();

		for (let i = 0; i <= lineSegmentCount; i++) {
			let t = i / lineSegmentCount;
			let point = curve.getPoint(t);
			this.line.geometry.attributes.instanceStart.setXYZ(
				i,
				point.x,
				point.y,
				point.z
			);
			this.line.geometry.attributes.instanceEnd.setXYZ(
				i - 1,
				point.x,
				point.y,
				point.z
			);
		}
		this.line.geometry.attributes.instanceStart.data.needsUpdate = true;
		if (this.indicator != undefined) {
			this.indicator.position.copy(curve.points[1]);
		}
	},

	/*method: drawEdge
		intialises the edge object3D and draws the edge geometry
		sets the this.line, this.indicator and this.edgeObjGroup attributes
	*/
	drawEdge: function () {
		if (this.edgeObjGroup != undefined) {
			//this removal loop gets executed for every call of drawEdge() but the first one
			//remove old edge
			this.el.object3D.remove(this.edgeObjGroup);
			cleanUpObject(this.edgeObjGroup);
		}

		let colors = [];
		let points = [];
		let color = new THREE.Color();
		let geoInstance = edgeGeo.clone();
		this.edgeObjGroup = new THREE.Group();
		this.indicator = undefined;

		curve.points = this.getCurveAnchors();
		for (let i = 0; i <= lineSegmentCount; i++) {
			let t = i / lineSegmentCount;
			let point = curve.getPoint(t);

			points.push(point.x, point.y, point.z);
			if (t < 0.5) {
				color.set(globalConfig.eColors[this.data.edgeConfig[2]]);
			} else {
				color.set(globalConfig.eColors[this.data.edgeConfig[3]]);
			}
			colors.push(color.r, color.g, color.b);
		}

		geoInstance.setPositions(points);
		geoInstance.setColors(colors);

		//geometry.addGroup(0, vLen, 0);
		//geometry.addGroup(vLen, vLen + 1, 1);

		if (this.edgeObjGroup == undefined) {
			// safeguard against trying to draw an edge that has already been removed
			return;
		}

		this.edgeObjGroup.name = "edge" + this.data.numId;
		if (this.data.amplitude < 1) {
			let mat = edgeMat.clone();
			mat.opacity = this.data.amplitude;
			this.line = new Line2(geoInstance, mat);
		} else {
			this.line = new Line2(geoInstance, edgeMat);
		}

		this.line.name = "line";
		this.edgeObjGroup.add(this.line);
		this.el.object3D.add(this.edgeObjGroup);

		// add indicator to negative weight edges
		if (this.data.phase < 3 / 2 && this.data.phase > 1 / 2) {
			//phase in units of pi
			this.indicator = indicatorMesh.clone();
			this.indicator.position.copy(curve.points[1]);
			this.indicator.name = "indicator";
			this.edgeObjGroup.add(this.indicator);
		}
	},

	/*method: updateConfig
		updates the this.data.edgeConfig of the edge to contain pointers to elements/components instead of numIds.

		Parameters:
			collider - optional parameter, if set the end vertex pointer points to the collider element, used during edge drawing
	*/
	updateConfig: function (collider) {
		// collider containes the collision vertex of the controller, if the edge is a floating edge
		this.data.edgeConfig = [
			this.graph.graphData.graph.vertices.filter(
				(v) =>
					v.data.numId == this.data.edgeConfig[0] ||
					v == this.data.edgeConfig[0]
			)[0],
			collider != undefined
				? collider
				: this.graph.graphData.graph.vertices.filter(
						(v) =>
							v.data.numId == this.data.edgeConfig[1] ||
							v == this.data.edgeConfig[1]
				  )[0],
			this.data.edgeConfig[2],
			this.data.edgeConfig[3],
		];
	},

	/*method:  getConfig
		returns the edge config from pointers back to serializable data

		Returns:
			newConfig - object containing the serializable edge config
	*/
	getConfig: function () {
		let newConfig = {
			id: this.data.numId,
			config: this.data.edgeConfig.map((e) =>
				Number.isInteger(e) ? e : e.data.numId
			),
			amplitude: this.data.amplitude,
			phase: this.data.phase,
			siblingConfig: this.data.siblingConfig,
		};

		return newConfig;
	},
});
