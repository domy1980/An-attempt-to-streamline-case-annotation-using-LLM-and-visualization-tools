from flask import Flask, render_template, jsonify, send_from_directory
import pandas as pd
import networkx as nx
from networkx.readwrite import json_graph
import os

app = Flask(__name__)

# ファイルパスの設定
tree_file = 'data/tree.csv'  # 親子構造のCSVファイルのパス
labels_file = 'data/labels.csv'  # ラベルの対応CSVファイルのパス

# CSVファイルが存在するか確認
if not os.path.exists(tree_file):
    print(f"エラー: {tree_file} が存在しません。ファイルパスを確認してください。")
    exit(1)
if not os.path.exists(labels_file):
    print(f"エラー: {labels_file} が存在しません。ファイルパスを確認してください。")
    exit(1)

# データの読み込み
try:
    df_tree = pd.read_csv(tree_file)
    df_labels = pd.read_csv(labels_file)
    print("データの読み込みに成功しました。")
except Exception as e:
    print(f"データの読み込み中にエラーが発生しました: {e}")
    exit(1)

# ラベルのマッピング（URLからラベルへ）
try:
    label_mapping = pd.Series(df_labels['label'].values, index=df_labels['term']).to_dict()
    print("ラベルのマッピングが成功しました。")
except Exception as e:
    print(f"ラベルのマッピング中にエラーが発生しました: {e}")
    exit(1)

# グラフの構築
try:
    G = nx.DiGraph()
    for _, row in df_tree.iterrows():
        for i in range(1, len(df_tree.columns)):
            node_col = f'Path Node {i}'
            next_node_col = f'Path Node {i+1}'
            if node_col in df_tree.columns and next_node_col in df_tree.columns:
                if pd.notna(row[node_col]) and pd.notna(row[next_node_col]):
                    parent_label = label_mapping.get(row[node_col], row[node_col])
                    child_label = label_mapping.get(row[next_node_col], row[next_node_col])
                    G.add_edge(parent_label, child_label)
    print("グラフの構築が成功しました。ノード数:", len(G.nodes), "エッジ数:", len(G.edges))
except Exception as e:
    print(f"グラフの構築中にエラーが発生しました: {e}")
    exit(1)

# グラフデータをJSON形式で返すエンドポイント
@app.route('/graph_data')
def get_graph_data():
    try:
        data = json_graph.node_link_data(G)
        print("グラフデータを返します:", data)  # デバッグ用にターミナルにデータを出力
        return jsonify(data)
    except Exception as e:
        print(f"グラフデータの生成中にエラーが発生しました: {e}")
        return jsonify({"error": "グラフデータの取得に失敗しました"}), 500

# メインのHTMLページを返すエンドポイント
@app.route('/')
def index():
    try:
        return render_template('index.html')
    except Exception as e:
        print(f"テンプレートの読み込み中にエラーが発生しました: {e}")
        return "<h1>テンプレートの読み込みに失敗しました。</h1>", 500

# faviconの設定（任意）
@app.route('/favicon.ico')
def favicon():
    try:
        return send_from_directory(os.path.join(app.root_path, 'static'),
                                   'favicon.ico', mimetype='image/vnd.microsoft.icon')
    except Exception as e:
        print(f"faviconの読み込み中にエラーが発生しました: {e}")
        return "", 404

if __name__ == '__main__':
    # Flaskアプリケーションの起動
    try:
        app.run(host='0.0.0.0', port=5002, debug=True)
    except Exception as e:
        print(f"Flaskアプリケーションの起動中にエラーが発生しました: {e}")


