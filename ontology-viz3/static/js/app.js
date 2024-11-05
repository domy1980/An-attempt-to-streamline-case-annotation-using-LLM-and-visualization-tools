// グラフデータの取得と描画
d3.json("/graph_data").then(function(graph) {
    console.log("取得したグラフデータ:", graph);
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
        console.error("グラフデータが取得できません。");
        return;
    }

    var width = 800, height = 600;

    var svg = d3.select("#graph-container").append("svg")
        .attr("width", width)
        .attr("height", height);

    // 階層構造の計算
    function computeHierarchy(nodes, links) {
        var nodeMap = new Map(nodes.map(d => [d.id, { ...d, children: [], depth: 0, tagged: false }]));
        
        links.forEach(link => {
            var source = nodeMap.get(link.source);
            var target = nodeMap.get(link.target);
            if (source && target) {
                source.children.push(target);
            }
        });

        function setDepth(node, depth) {
            node.depth = Math.max(node.depth, depth);
            node.children.forEach(child => setDepth(child, depth + 1));
        }

        // ルートノードを見つけて深さを設定
        nodeMap.forEach(node => {
            if (!links.some(link => link.target === node.id)) {
                setDepth(node, 0);
            }
        });

        return Array.from(nodeMap.values());
    }

    var hierarchicalNodes = computeHierarchy(graph.nodes, graph.links);
    var maxDepth = d3.max(hierarchicalNodes, d => d.depth);

    var simulation = d3.forceSimulation(hierarchicalNodes)
        .force("link", d3.forceLink(graph.links).id(d => d.id).distance(50))
        .force("charge", d3.forceManyBody().strength(-100))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("y", d3.forceY(d => (d.depth / maxDepth) * (height - 100) + 50).strength(1));

    var link = svg.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(graph.links)
        .join("line")
        .attr("stroke-width", d => Math.sqrt(d.value));

    var node = svg.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(hierarchicalNodes)
        .join("circle")
        .attr("r", 5)
        .attr("fill", d => d.tagged ? "#ff0000" : "#69b3a2")
        .call(drag(simulation));

    node.append("title")
        .text(d => d.id);

    function updateNodePositions() {
        var taggedNodes = hierarchicalNodes.filter(d => d.tagged);
        var untaggedNodes = hierarchicalNodes.filter(d => !d.tagged);

        // タグ付けされたノードを水平に配置
        taggedNodes.forEach((node, index) => {
            node.fx = (index + 1) * (width / (taggedNodes.length + 1));
            node.fy = (node.depth / maxDepth) * (height - 100) + 50;
        });

        // タグ付けされていないノードの固定を解除
        untaggedNodes.forEach(node => {
            node.fx = null;
            node.fy = null;
        });

        simulation.alpha(1).restart();
    }

    function toggleTag(d) {
        d.tagged = !d.tagged;
        updateNodePositions();
        node.attr("fill", d => d.tagged ? "#ff0000" : "#69b3a2");
    }

    // ノードのクリックイベントを追加
    node.on("click", (event, d) => {
        toggleTag(d);
    });

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    });

    function drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            if (!event.subject.tagged) {
                event.subject.fx = null;
                event.subject.fy = null;
            }
        }
        
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

}).catch(function(error) {
    console.error("データの取得に失敗しました:", error);
});