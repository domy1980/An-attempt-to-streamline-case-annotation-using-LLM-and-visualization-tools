// グラフデータの取得と描画
d3.json("/graph_data").then(function(graph) {
    console.log(graph);  // データが正しく取得できているか確認
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
        console.error("グラフデータが取得できません。");
        return;
    }

    // ノードにラベルがない場合、IDをラベルとして使用
    graph.nodes.forEach(node => {
        if (!node.label) {
            node.label = node.id;
        }
    });

    var width = 1000, height = 600;

    var svg = d3.select("#graph-container").append("svg")
        .attr("width", width)
        .attr("height", height);

    // カスタムモーダルの作成
    var modal = d3.select("body").append("div")
        .attr("class", "modal")
        .style("display", "none")
        .style("position", "absolute")
        .style("z-index", "1000")
        .style("width", "80%")
        .style("max-width", "600px")
        .style("background-color", "white")
        .style("padding", "20px")
        .style("border", "1px solid #888")
        .style("box-shadow", "0 4px 8px 0 rgba(0,0,0,0.2)");

    var modalHeader = modal.append("div")
        .style("cursor", "move")
        .style("padding", "10px")
        .style("background-color", "#f1f1f1")
        .style("user-select", "none");

    modalHeader.append("span")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("ノード情報");

    var closeBtn = modalHeader.append("span")
        .attr("class", "close")
        .style("color", "#aaa")
        .style("float", "right")
        .style("font-size", "28px")
        .style("font-weight", "bold")
        .style("cursor", "pointer")
        .text("×")
        .on("click", () => modal.style("display", "none"));

    var modalContent = modal.append("div")
        .attr("class", "modal-content")
        .style("max-height", "calc(70vh - 60px)")
        .style("overflow-y", "auto");

    // ドラッグ機能の実装
    var isDragging = false;
    var currentX;
    var currentY;
    var initialX;
    var initialY;
    var xOffset = 0;
    var yOffset = 0;

    modalHeader.call(d3.drag()
        .on("start", dragStart)
        .on("drag", drag)
        .on("end", dragEnd));

    function dragStart(event) {
        initialX = event.x - xOffset;
        initialY = event.y - yOffset;
        isDragging = true;
    }

    function drag(event) {
        if (isDragging) {
            event.sourceEvent.preventDefault();
            currentX = event.x - initialX;
            currentY = event.y - initialY;
            xOffset = currentX;
            yOffset = currentY;
            setTranslate(currentX, currentY, modal);
        }
    }

    function dragEnd(event) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function setTranslate(xPos, yPos, el) {
        el.style("transform", `translate(${xPos}px, ${yPos}px)`);
    }

    // 階層構造を計算
    function computeHierarchy(nodes, links) {
        var nodeMap = new Map(nodes.map(d => ({
            ...d,
            children: [],
            collapsed: false,
            originalSize: 10,
            size: 10,
            label: d.label || d.id  // ラベルがない場合はIDを使用
        })).map(d => [d.id, d]));
        
        links.forEach(link => {
            var parent = nodeMap.get(link.source);
            var child = nodeMap.get(link.target);
            if (parent && child) {
                parent.children.push(child);
                child.parent = parent;  // 親への参照を追加
            }
        });
        
        // ルートノードを見つける（親がいないノード）
        var roots = Array.from(nodeMap.values()).filter(node => !node.parent);
        
        // 深さを計算
        function setDepth(node, depth) {
            node.depth = depth;
            node.children.forEach(child => setDepth(child, depth + 1));
        }
        roots.forEach(root => setDepth(root, 0));

        return Array.from(nodeMap.values());
    }

    var hierarchicalNodes = computeHierarchy(graph.nodes, graph.links);
    var maxDepth = d3.max(hierarchicalNodes, d => d.depth);

    // レイアウトの設定
    var yScale = d3.scaleLinear()
        .domain([0, maxDepth])
        .range([50, height - 50]);

    function updateNodePositions() {
        hierarchicalNodes.forEach(function(node) {
            node.y = yScale(node.depth);
            // 各階層内でのX座標を計算
            var sameDepthNodes = hierarchicalNodes.filter(d => d.depth === node.depth);
            var index = sameDepthNodes.indexOf(node);
            node.x = (index + 1) * (width / (sameDepthNodes.length + 1));
        });
    }

    updateNodePositions();

    var simulation = d3.forceSimulation(hierarchicalNodes)
        .force("link", d3.forceLink(graph.links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("x", d3.forceX(d => d.x).strength(0.5))
        .force("y", d3.forceY(d => d.y).strength(0.8));

    var link = svg.append("g")
        .selectAll("line")
        .data(graph.links)
        .enter().append("line")
        .attr("stroke-width", 2)
        .attr("stroke", "#999");

    var node = svg.append("g")
        .selectAll("circle")
        .data(hierarchicalNodes)
        .enter().append("circle")
        .attr("r", d => d.size)
        .attr("fill", d => d.depth === 0 ? "#ff7f0e" : "#69b3a2")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    node.append("title")
        .text(d => d.id);

    var labels = svg.append("g")
        .selectAll("text")
        .data(hierarchicalNodes)
        .enter().append("text")
        .attr("dx", 12)
        .attr("dy", ".35em")
        .text(d => d.label);

    // コンテキストメニューの作成
    var contextMenu = d3.select("body").append("div")
        .attr("class", "context-menu")
        .style("position", "absolute")
        .style("display", "none")
        .style("background-color", "white")
        .style("border", "1px solid black")
        .style("padding", "5px")
        .style("cursor", "pointer");

    // 右クリックイベントの処理
    node.on("contextmenu", function(event, d) {
        event.preventDefault();
        contextMenu.style("left", (event.pageX + 5) + "px")
            .style("top", (event.pageY - 5) + "px")
            .style("display", "block");
        
        contextMenu.html("");
        contextMenu.append("div")
            .text(d.collapsed ? "子ノードを展開" : "子ノードを収納")
            .on("click", () => {
                toggleChildren(d);
                contextMenu.style("display", "none");
            });
        contextMenu.append("div")
            .text("タグ付け")
            .on("click", () => {
                tagNode(d);
                contextMenu.style("display", "none");
            });
        contextMenu.append("div")
            .text("ノード情報")
            .on("click", () => {
                showNodeInfo(event, d);
                contextMenu.style("display", "none");
            });
    });

    // 背景をクリックしたらコンテキストメニューを閉じる
    svg.on("click", () => contextMenu.style("display", "none"));

    function toggleChildren(d) {
        if (d.collapsed) {
            expandNode(d);
        } else {
            collapseNode(d);
        }
        updateGraph();
    }

    function collapseNode(d) {
        d.collapsed = true;
        collapseChildrenRecursively(d);
    }

    function collapseChildrenRecursively(node) {
        if (node.children) {
            node.children.forEach(child => {
                child.size = 2;  // 子ノードを小さくする
                collapseChildrenRecursively(child);
            });
        }
    }

    function expandNode(d) {
        d.collapsed = false;
        expandChildrenRecursively(d);
    }

    function expandChildrenRecursively(node) {
        if (node.children) {
            node.children.forEach(child => {
                child.size = child.originalSize;  // 元のサイズに戻す
                if (child.collapsed) {
                    collapseChildrenRecursively(child);
                } else {
                    expandChildrenRecursively(child);
                }
            });
        }
    }

    function tagNode(d) {
        var color = prompt("ノードの新しい色を入力してください（例：red, #FF0000）:");
        if (color) {
            d.color = color;
            updateGraph();
        }
    }

    function showNodeInfo(event, d) {
        // 親ノードの情報を取得
        let parentInfo = d.parent 
            ? `${d.parent.id} (${d.parent.label || 'ラベルなし'})`
            : 'なし（ルートノード）';

        // 子ノードの情報を取得
        let childrenInfo = d.children && d.children.length > 0
            ? d.children.map(child => `${child.id} (${child.label || 'ラベルなし'})`).join('<br>    ')
            : 'なし';

        let infoText = `
            <strong>HPO_ID:</strong> ${d.id}<br>
            <strong>ラベル:</strong> ${d.label || 'なし'}<br>
            <strong>層の数:</strong> ${d.depth}<br>
            <strong>直接の親ノード:</strong> ${parentInfo}<br>
            <strong>直接の子ノードの数:</strong> ${d.children ? d.children.length : 0}<br>
            <strong>直接の子ノード:</strong><br>    ${childrenInfo}
        `;

        modalContent.html(infoText);
        
        // クリックした位置の近くにモーダルを表示
        var clickX = event.pageX;
        var clickY = event.pageY;
        
        modal.style("display", "block")
            .style("left", "0px")
            .style("top", "0px")
            .style("transform", `translate(${clickX}px, ${clickY}px)`);

        // 初期位置を設定
        xOffset = clickX;
        yOffset = clickY;
    }

    function updateGraph() {
        // ノードを更新
        node.data(hierarchicalNodes, d => d.id)
            .attr("r", d => d.size)
            .attr("fill", d => d.color || (d.depth === 0 ? "#ff7f0e" : (d.collapsed ? "#b3b3b3" : "#69b3a2")));

        // リンクを更新
        link.attr("opacity", d => (d.source.collapsed || d.target.size === 2) ? 0.3 : 1)
            .attr("stroke-width", d => (d.source.collapsed || d.target.size === 2) ? 1 : 2);

        // ラベルを更新
        labels.attr("opacity", d => d.size === 2 ? 0 : 1);

        simulation.alpha(1).restart();
    }

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        labels
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}).catch(function(error) {
    console.error("データの取得に失敗しました:", error);
});