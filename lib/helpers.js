/*
This is JavaScript port of the perfect-matching alghorithm of PyTheus
See https://github.com/artificial-scientist-lab/PyTheus for the original
python code
*/

/*function: edgeBleach

	Turns a array of colored edges into a list of objects where edges are grouped by covering in the following format:

	{
		cover: [node1, node2],
		colors: [[color1, color2], [color3, color4] ...]
	}

	Parameters:

		coloredEdges - array of edges in the following format:
			[node1, node2, color1, color2]
	
	Returns:

		bleachedEdges - array of objects in the following format:
			{
				cover: [node1, node2],
				colors: [[color1, color2], [color3, color4] ...]
			}


*/
function edgeBleach(coloredEdges) {
	coverings = [];
	colors = [];
	coloredEdges.forEach((edge) => {
		coverings.push(edge.slice(0, 2));
	});
	rawEdges = unique(coverings);

	bleachedEdges = [];
	rawEdges.forEach((raw) => {
		bleachedEdges.push({
			cover: raw,
			colors: coloredEdges
				.filter((edge) => arraysEqual(edge.slice(0, 2), raw))
				.map((edge) => edge.slice(2)),
		});
	});
	return bleachedEdges;
}

/*function: edgePaint

	takes a list of uncolored subgraphs into colored subgraphs by assigning available colors to the edges.

	Parameters:

		rawSubGraphs - array of uncolored PMs 
		availColors - array of objects containing available colors for each cover

	Returns:
	
		paintedCovers - array of colored subgraphs

*/
function edgePaint(rawSubGraphs, availColors) {
	rawSubGraphs = unique(rawSubGraphs);
	paintedCovers = [];
	rawSubGraphs.forEach((cover) => {
		colors = [];
		cover.forEach((edge) => {
			colors.push(
				...availColors
					.filter((c) => arraysEqual(edge, c.cover))
					.map((c) => c.colors)
			);
		});
		coloring = cartesianProduct(colors);

		coloring.forEach((color) => {
			colored_cover = [];
			for (let i = 0; i < cover.length; i++) {
				const edge = cover[i];
				const colors = color[i];
				colored_cover.push(edge.concat(colors));
			}
			paintedCovers.push(colored_cover);
		});
	});
	return unique(paintedCovers);
}

/*function: recursivePerfectMatchings

	Recursively finds all perfect matchings in a graph.
	Performs inplace modification of the store parameter.
	

	Parameters:

		graph - array of edges
		store - ToDo
		matches - ToDo
		edges_left - ToDo

	Returns:
		none
*/
function recursivePerfectMatchings(
	graph,
	store,
	matches = [],
	edges_left = null
) {
	if (edges_left == null) {
		edges_left =
			[...new Set(graph.map((g) => g.slice(0, 2)).flat())].length / 2;
	}
	if (graph.length > 0) {
		tmpGraph = targetEdges([nodeDegrees(graph)[0][0]], graph);
		tmpGraph.forEach((edge) => {
			recursivePerfectMatchings(
				removeNodes(graph, edge.slice(0, 2)),
				store,
				matches.concat([edge]),
				edges_left - 1
			);
		});
	} else {
		if (edges_left == 0 && graph.length == 0) {
			store.push(matches);
		} else {
			return;
		}
	}
}

/*function: findPerfectMatchings

	Finds all perfect matchings in a graph.
	Wrapper function for recursivePerfectMatchings.

	Parameters:
	
		graph - array of edges

	Returns:	

		paintedMatchings - array of colored perfect matchings
*/
function findPerfectMatchings(graph) {
	availColors = edgeBleach(graph);

	rawMatchings = []; //storage array where the recursive loops stores the found matchings
	recursivePerfectMatchings(
		availColors.map((c) => c.cover),
		rawMatchings
	);

	paintedMatchings = edgePaint(rawMatchings, availColors);
	return paintedMatchings;
}

/*function: targetEdges

	Finds all edges in a graph that are connected to a given set of nodes.

	Parameters:

		nodes - array of nodes
		graph - array of edges

	Returns:

		edges - array of edges connected to the given nodes

*/
function targetEdges(nodes, graph) {
	//purely written by github copilot
	edges = [];
	graph.forEach((edge) => {
		if (nodes.includes(edge[0]) || nodes.includes(edge[1])) {
			edges.push(edge);
		}
	});
	return edges;
}

/*function: removeNodes

	Removes a set of nodes from a graph.

	Parameters:

		graph - array of edges
		nodes - array of nodes

	Returns:

		graph - array of edges without the given nodes

*/
function removeNodes(graph, nodes) {
	//purely written by github copilot
	return graph.filter(
		(edge) => !nodes.includes(edge[0]) && !nodes.includes(edge[1])
	);
}

/*function: nodeDegrees

	Computes the degree of each node in a graph.

	Parameters:

		graph - array of edges

	Returns:

		degrees - array of arrays of nodes and their degree
	
*/
function nodeDegrees(graph) {
	//mostly written by github copilot
	degrees = [];
	nodes = [];
	graph.forEach((edge) => {
		nodes.push(edge[0]);
		nodes.push(edge[1]);
	});
	degrees = [...new Set(nodes)];
	degrees = degrees.map((degree) => [
		degree,
		nodes.filter((d) => d == degree).length,
	]);
	return degrees;
}

/*function: cartesianProduct

	Computes the cartesian product of a set of arrays.

	Parameters:

		arrayOfArrays - array of arrays

	Returns:

		shapedArr - array of arrays containing the cartesian product	
*/
function cartesianProduct(arrayOfArrays) {
	//this was github copilot code, looks similar to this answer https://stackoverflow.com/a/43053803 at  https://stackoverflow.com/questions/12303989/cartesian-product-of-multiple-arrays-in-javascript
	flatArr = arrayOfArrays.reduce((a, b) =>
		a.flatMap((d) => b.map((e) => [d, e].flat()))
	);
	return flatArr.map((f) => {
		shapedArr = [];
		while (f.length > 0) {
			shapedArr.push(f.splice(0, 2));
		}
		return shapedArr;
	});
}

/*function: unique(arrayOfArrays)

	Removes duplicates from an array of arrays.

	Parameters:

		arrayOfArrays - array of arrays

	Returns:

		uniques - array of arrays without duplicates
*/
function unique(arrayOfArrays) {
	uniques = [];
	arrayOfArrays.forEach((array) => {
		if (!overlap(uniques, array)) {
			uniques.push(array);
		}
	});
	return uniques;
}


/*function: overlap

	Checks if an array is contained in an array of arrays.

	Parameters:

		arrayOfArrays - array of arrays
		array - array to check

	Returns:

		true if array is contained in arrayOfArrays, false otherwise
*/
function overlap(arrayOfArrays, array) {
	//purely written by github copilot
	return arrayOfArrays.some((a) => a.every((v, i) => v === array[i]));
}

/*function: arraysEqual

	Checks if two arrays are equal.

	Parameters:

		a - array
		b - array

	Returns:

		true if a and b are equal, false otherwise
*/
function arraysEqual(a, b) {
	//purely written by github copilot
	return (
		Array.isArray(a) &&
		Array.isArray(b) &&
		a.length === b.length &&
		a.every((val, index) => val === b[index])
	);
}

/*function: range

	Generates an array of integers from start to end.
	(Like the python range function)

	Parameters:

		start - integer
		end - integer

	Returns:

		array of integers from start to end
*/
function range(start, end) {
	//purely written by github copilot
	return Array(end - start)
		.fill()
		.map((_, idx) => start + idx);
}


//------------end of perfect matching alghoritm------------


/*function: cleanUpObject

	Recursively removes all children of an THREE.js object3D and disposes of their geometry and material.

	Parameters:

		object - object to clean up

	Returns:

		none

*/
function cleanUpObject(object) {
	object.children.forEach((child) => {
		cleanUpObject(child);
	});

	if (object.geometry != undefined && object.material != undefined) {
		console.log("cleaning up", object);
		let material = object.material;
		if (material instanceof THREE.Material) {
			material.dispose();
		} else if (Array.isArray(material)) {
			for (let i = 0; i < material.length; ++i) {
				material[i].dispose();
			}
		}
		object.geometry.dispose();
	}
	object.removeFromParent();
	return;
}

/*function: buildEntries4Config

	Builds the entries for the pytheus search config file from the graph data.

	Parameters:

		graphData - graph data object from the graph-component

	Returns:

		result - object containing the entries for the config file
*/
function buildEntries4Config(graphData) {
	let edges = graphData.graph.edges.map((edge) => edge.getConfig().config);
	let vertices = graphData.graph.vertices;
	let result = {
		removed_connections: [],
		init_graph: [],
		nodes2connect: [],
	};

	// colored edges remain fixed
	let fixedEdges = edges.filter(
		(edgeConf) => edgeConf[2] != 99 && edgeConf[3] != 99
	);
	// black edges in the template are to tbe optimised
	let edgesToBeOptimised = edges
		.filter((edgeConf) => edgeConf[2] == 99 || edgeConf[3] == 99)
		.map((edgeConf) => [edgeConf[0], edgeConf[1]]);

	if (fixedEdges.length != 0) {
		// if there is an initial graph init_graph and nodes2connect are used to specify the optimisation
		result["init_graph"] = fixedEdges;
		result.nodes2connect = edgesToBeOptimised;
	} else {
		// if there is no initial graph, the optimisation is done with the removedConnections keyword
		let notNeighbours

		for (let i = 0; i < vertices.length; i++) {
			const vertex = vertices[i];
			notNeighbours = vertices.filter(
				(v) => !vertex.data.neighbours.includes(v) & v.data.numId > vertex.data.numId
			);
			result.removed_connections.push(...notNeighbours.map((v) => [vertex.data.numId, v.data.numId]));
			
		}
	}
	return result;
}

/*function: download

	Downloads a file to the local machine.

	Parameters:

		content - content of the file
		fileName - name of the file
		contentType - type of the file [eg. 'json']

	Returns:
	
		none
*/
function download(content, fileName, contentType) {
	var a = document.createElement("a");
	var file = new Blob([content], { type: contentType });
	a.href = URL.createObjectURL(file);
	a.download = fileName;
	a.click();
	console.log('download initiated')
	URL.revokeObjectURL(a.href)
	a.remove();
	
}
