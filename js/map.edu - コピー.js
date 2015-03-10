///////////////////////////////////////////////////////////////////////////////////////
//  2014年9月  宇根メモ
//
// 【概略】
//  Google Mapをベースで表示させている。
//  別途、D3.jsを使ってTopoJSONファイルとcsvを読み込み、Google Mapに重ねて描画。
//
// 【CSVファイルの仕様】
// -kenbetsu.csv（都道府県別データ：47行）
//   id:市町村名（アルファベット）
//   rate2040：2040年の限界学校割合(%)
//   rate2013：2013年の限界学校割合(%)
//   limitNum2040:2040年の限界数
//   limitNum2013:2013年の限界数
//
// -shibetsu.csv（市町村別データ：1683行）
//   id:市町村コード
//   town:市町村名（日本語）※UTF8
//   rate2040：2040年の限界学校割合(%)
//   rate2013：2013年の限界学校割合(%)
//
// 【TopoJSONファイルの仕様】
//  日本列島全体（borders47.json）と別に47個の都道府県ファイルがある。ズームすると後者の地図に切り替わる。
//  
// 【塗り分け】
//  紙面に準ずる
//
// 【フロー】
//   csvファイルは2つ。TopoJSONファイルは48個。D3.jsのqueue()で全てのJSONの読み込みを待つ。	
//
// 【当初からの変更点】
//  tsvとtopojsonの拡張子は使えないとのことでtsvはcsvに作り替えた（jsコードはほとんど修正不要！）。
//　　topojsonは拡張子をjsonに変更しただけ。
//  ツールチップ表示の位置は固定した。
//  クラスの付け替えのためjQueryを導入。
//
///////////////////////////////////////////////////////////////////////////////////////


google.maps.event.addDomListener(window, 'load', function() {

	var tsv_2013_city = [];		//csvファイルの2013年データ(%)（市町村） eg) tsv_2013_city['44211'] = 34.62%
	var tsv_2040_city = []; 	//csvファイルの2040年データ(%)（市町村）
	var tsv_2013_pref = [];  	//csvファイルの2013年データ(%)（都道府県）
	var tsv_2040_pref = [];  	//csvファイルの2040年データ(%)（都道府県）
	var tsv_2013_limit_pref = [];	//csvファイルの限界数（都道府県）
	var tsv_2040_limit_pref = [];	//csvファイルの限界数（都道府県）
	var tsv_town_name = [];		//ｃｓｖファイルの市町村名（UTF8日本語）
 	var yearState;				//HTMLで2013年か2040年を指定
 	var maxData;				//ツールチップ内に限界数の棒グラフを表示するために使用（csvの最大値で正規化）
 	//var cnt = 0;				//デバッグ用カウンタ

	var myVal;

 	//////////////////////////////////////// 初期化処理 ここから ////////////////////////////////////////
	var prefMode = true;	//都道府県表示か市町村表示かのフラグ（真で都道府県表示モード）　
	var prevState = 'pref';	//ズームレベルが変化する前の表示モード。 city か prefが入る。
	var initZoom = 5;		//ズームの初期値
 	var yearRadioList = document.getElementsByName("year");	//ラジオボタンから西暦を取得

 	//西暦を判別し、h2タグの内容を切り替える
	setYear();

	//ツールチップ追加
	var tooltip = d3.select("#svgmap")
			.append("div")
			.attr("class", "tooltip");
			//.style("visibility", "hidden"); //最初は消す
 	//////////////////////////////////////// 初期化処理 ここまで ////////////////////////////////////////

	//Google Map パラメーター設定
	var myStyles = [
		{
			elementType: "geometry",	//「幾何学要素」のみ選択
			stylers: [{saturation: -100}]	//地図色をグレーに。
		},
		{
			featureType: "road",
			stylers: [{visibility: "off"}]	//道路を非表示
		},
		{
			"featureType": "transit.line", //鉄道を非表示
			"stylers": [{ "visibility": "off" }]
		},
		{
			featureType: 'administrative.province', elementType: 'geometry', //県境設定
			stylers: [{ "color": "#000000" },{ weight : 1 }] //黒
		}
	];
 
	var mapOptions = {
		zoom: initZoom,
		maxZoom: 11,
		minZoom: 5,
		center: new google.maps.LatLng(38, 137), //中心座標を緯度経度で指定
		styles: myStyles,
	    mapTypeControlOptions: {
	        position: google.maps.ControlPosition.TOP_RIGHT //マップタイプコントロール位置
	    },
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		panControl: false	//左上の移動コントロールを消す
	};
	
	//Google Maps API初期化
	var map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
	
	//描画スタイルを指定
	 function styleFeature(){
	 	// cnt++;
	 	// console.log("cnt=\t", cnt);

		return function(feature){
			
			var tmpColor;
			var tmpOpacity;
			var tmpStrokeColor;
			var tmpStrokeWeight;
			var tmpStrokeOpacity;
			var tmpZindex;
			

			//塗り色を設定
			if(prefMode){ //都道府県表示モードの場合
				if(yearState == "YEAR2013"){
					tmpColor = getColor(tsv_2013_pref[feature.getProperty('pref')]);
				}
				else if(yearState == "YEAR2040"){
					tmpColor = getColor(tsv_2040_pref[feature.getProperty('pref')]);
				}
			}
			else{ //市町村表示モードの場合
				if(yearState == "YEAR2013"){
					tmpColor = getColor(tsv_2013_city[feature.getProperty('city_code')]);
				}
				else if(yearState == "YEAR2040"){
					tmpColor = getColor(tsv_2040_city[feature.getProperty('city_code')] );
				}
			};

			
			// //////////////////////////////////// DEBUG CODE ////////////////////////////////////
			// if(prefMode){	//都道府県モードの時
			// 	if(tsv_2013_pref[feature.getProperty('pref')] == null){ //rate2013がnullだったら青く
			// 		tmpColor = "blue";
			// 		tmpOpacity = 1.0;
			// 	}
			// 	if(tsv_2040_pref[feature.getProperty('pref')] == null){ //rate2040がnullだったら青く
			// 		tmpColor = "blue";
			// 		tmpOpacity = 1.0;
			// 	}
			// 	if(feature.getProperty('pref') == null){ //city_codeがnullだったら青く
			// 		//console.log(feature.getProperty('city_code'));
			// 		tmpColor = "blue";
			// 		tmpOpacity = 1.0;
			// 	}
			// }
			// else{	//市町村モードの時
			// 	if(tsv_2013_city[feature.getProperty('city_code')] == null){ //rate2013がnullだったら青く
			// 		tmpColor = "blue";
			// 		tmpOpacity = 1.0;
			// 	}
			// 	if(tsv_2040_city[feature.getProperty('city_code')] == null){ //rate2040がnullだったら青く
			// 		tmpColor = "blue";
			// 		tmpOpacity = 1.0;
			// 	}
			// 	if(feature.getProperty('city_code') == null){ //city_codeがnullだったら青く
			// 		//console.log(feature.getProperty('city_code'));
			// 		tmpColor = "blue";
			// 		tmpOpacity = 1.0;
			// 	}
			// }
			// //////////////////////////////////// DEBUG CODE ////////////////////////////////////

			//マウスオーバーで色を変更させる
			if (feature.getProperty('state') === 'hover') {
				tmpOpacity = 0.7;
				tmpStrokeColor = '#555555';
				tmpStrokeOpacity = 1.0;
				tmpStrokeWeight = 3; //デフォルトより太く
				tmpZindex = 5; //デフォルト(4)より大きく
			}
			else{
				tmpOpacity = 0.7;
				tmpStrokeColor = 'white';
				tmpStrokeOpacity = 0.0; //デフォルトは線を透明に
				tmpStrokeWeight = 1;
				tmpZindex = 4;
			};


		 	///////////表示モード（市町村表示 or 都道府県）の切り替え（ここから）///////////
			if(prefMode){
				//都道府県表示モードの場合は市町村の塗りを消し、そのzindexを落とす（触れないようにする）
				if(feature.getProperty('city_code')){ //jsonが市町村のデータを持っていたら隠す
					tmpZindex = -10;
					tmpOpacity = 0.0;
				}
			}
			else{
				//市町村表示モードの場合は都道府県の塗りを消し、そのzindexを落とす（触れないようにする）
				if(feature.getProperty('pref')){ //jsonが都道府県のデータを持っていたら隠す
					tmpZindex = -10;
					tmpOpacity = 0.0;
				}
			};
			///////////表示モード（市町村表示 or 都道府県）の切り替え（ここまで）///////////

			return {
				strokeWeight: tmpStrokeWeight,
				strokeColor: tmpStrokeColor,
				strokeOpacity: tmpStrokeOpacity,
				zIndex: tmpZindex,
				fillColor: tmpColor,
				fillOpacity: tmpOpacity,
				visible: true
			};		
		}
	
	};//styleFeature
	
	//CSV読み込み1（市町村データ:1800個）
	d3.csv("csv/shibetsu3.csv", function(error, dataTsv){
		for(var i=0; i<dataTsv.length; i++){
			tsv_2013_city[dataTsv[i].id] = parseFloat(dataTsv[i].rate2013);	//2013年(%)
			tsv_2040_city[dataTsv[i].id] = parseFloat(dataTsv[i].rate2040);	//2040年(%)
			//console.log(dataTsv[i].id + "\t" + tsv_2013_city[dataTsv[i].id] + "\t" + tsv_2040_city[dataTsv[i].id] );//dataTsv[i].idが市町村コード
			tsv_town_name[dataTsv[i].id] = String(dataTsv[i].town);
			//console.log(dataTsv[i].id + "\t" + tsv_town_name[dataTsv[i].id]);
		};
		//console.log("CSVファイルの市町村数:" + Object.keys(tsv_2013_city).length);


		//市町村セレクタ（一覧から選択）:都道府県選択
		function fnc_myForm2(){

			myVal = $('#search_pref').val();
			//console.log(myVal);

			$('#search_town').html('');
			$('#search_town').append($('<option>', { text:'選択してください' ,value:''}));

			     if(myVal ==  1){ createList(   1,  179); }
			else if(myVal ==  2){ createList( 180,  219); }
			else if(myVal ==  3){ createList( 220,  252); }
			else if(myVal ==  4){ createList( 253,  287); }
			else if(myVal ==  5){ createList( 288,  312); }
			else if(myVal ==  6){ createList( 313,  347); }
			else if(myVal ==  7){ createList( 348,  348); }
			else if(myVal ==  8){ createList( 349,  392); }
			else if(myVal ==  9){ createList( 393,  417); }
			else if(myVal == 10){ createList( 418,  452); }
			else if(myVal == 11){ createList( 453,  515); }
			else if(myVal == 12){ createList( 516,  569); }
			else if(myVal == 13){ createList( 570,  631); }
			else if(myVal == 14){ createList( 632,  664); }
			else if(myVal == 15){ createList( 665,  694); }
			else if(myVal == 16){ createList( 695,  709); }
			else if(myVal == 17){ createList( 710,  728); }
			else if(myVal == 18){ createList( 729,  745); }
			else if(myVal == 19){ createList( 746,  772); }
			else if(myVal == 20){ createList( 773,  849); }
			else if(myVal == 21){ createList( 850,  891); }
			else if(myVal == 22){ createList( 892,  926); }
			else if(myVal == 23){ createList( 927,  980); }
			else if(myVal == 24){ createList( 981, 1009); }
			else if(myVal == 25){ createList(1010, 1028); }
			else if(myVal == 26){ createList(1029, 1054); }
			else if(myVal == 27){ createList(1055, 1097); }
			else if(myVal == 28){ createList(1098, 1138); }
			else if(myVal == 29){ createList(1139, 1177); }
			else if(myVal == 30){ createList(1178, 1207); }
			else if(myVal == 31){ createList(1208, 1226); }
			else if(myVal == 32){ createList(1227, 1245); }
			else if(myVal == 33){ createList(1246, 1272); }
			else if(myVal == 34){ createList(1273, 1295); }
			else if(myVal == 35){ createList(1296, 1314); }
			else if(myVal == 36){ createList(1315, 1338); }
			else if(myVal == 37){ createList(1339, 1355); }
			else if(myVal == 38){ createList(1356, 1375); }
			else if(myVal == 39){ createList(1376, 1409); }
			else if(myVal == 40){ createList(1410, 1469); }
			else if(myVal == 41){ createList(1470, 1489); }
			else if(myVal == 42){ createList(1490, 1510); }
			else if(myVal == 43){ createList(1511, 1555); }
			else if(myVal == 44){ createList(1556, 1573); }
			else if(myVal == 45){ createList(1574, 1599); }
			else if(myVal == 46){ createList(1600, 1642); }
			else if(myVal == 47){ createList(1643, 1683); };

			function createList(s,g){
				for(var i = s-1; i < g; i++){
					$('#search_town').append($('<option>', { text: dataTsv[i].town ,value:'' }));
				};
			};

		};//fnc_myForm2


		//半角記号エスケープ関数
		function TextKakunin(str){

			str = (str).replace(/&/g,"＆").replace(/"/g,"”").replace(/'/g,"’").replace(/</g,"＜").replace(/>/g,"＞").replace(/\(/g,"（").replace(/\)/g,"）").replace(/\[/g,"［").replace(/\]/g,"］").replace(/\#/g,"＃").replace(/\;/g,"；").replace(/\,/g,"，").replace(/\./g,"．").replace(/\+/g,"＋").replace(/\*/g,"＊").replace(/\~/g,"[チルダ]").replace(/\:/g,"：").replace(/\!/g,"！").replace(/\^/g,"＾").replace(/\$/g,"＄").replace(/\=/g,"＝").replace(/\|/g,"｜").replace(/\//g,"／").replace(/\\/g,"￥").replace(/	/g,"　").replace(/\%/g,"％").replace(/\-/g,"－").replace(/\+/g,"＋").replace(/\{/g,"｛").replace(/\}/g,"｝").replace(/\?/g,"？").replace(/\@/g,"＠").replace(/\*/g,"＊").replace(/\_/g,"＿").replace(/\｢/g,"「").replace(/\｣/g,"」").replace(/\^/g,"＾").replace(/\`/g,"｀");

			return str;

		};

		//市町村セレクタ（自由記述フォーム）
		$('#btn_search').click(function(){

			myVal = $('#myForm input').val();//テキストフォームに入力された文字を取得

			myVal_esc = TextKakunin(myVal);//半角記号エスケープ関数を実行

			if(myVal_esc === '鹿嶋' || myVal_esc === '鹿嶋市'){
				myVal_esc = '茨城県鹿嶋市';
				geocoding(myVal_esc);
			}else if(myVal_esc === '鹿島' || myVal_esc === '鹿島市'){
				myVal_esc = '佐賀県鹿島市';
				geocoding(myVal_esc);
			}else{
				geocoding(myVal_esc);
			};
	

			if(myVal != ''){
				document.formname.prefname.selectedIndex = 0;//県フォームをクリア
				document.formname.townname.innerHTML = '<option value="0">-------------------</option>';//市町村フォームをクリア
			}

		});

		//フォームのEnterーキー無効
		$('#myForm input').keypress(function(e){

			//console.log("press");
			if (!e) var e = window.event;
				if(e.keyCode == 13)
				return false;

		});

		//市町村セレクタ（一覧から選択）：都道府県選択
		$('#search_pref').change(function(){

			fnc_myForm2();
			document.formname.inputname.value = '';//自由記述フォームをクリア

		});

		//市町村セレクタ（一覧から選択）：市町村選択

		$('#search_town').change(function(){

			myPrefname = $('[name=prefname] option:selected').text();//佐賀と茨城に鹿島市が２つあるので県名を必要
			myVal = myPrefname;
			myVal += $('[name=townname] option:selected').text();
			myVal_esc = TextKakunin(myVal);//半角記号エスケープ関数を実行
			//console.log("結果:"+myVal);
			geocoding(myVal_esc);
			document.formname.inputname.value = '';//自由記述フォームをクリア

		});

		//Yahooジオコーディング結果の緯度経度へ移動
		function geocoding(myVal){
			var geocoder = new Y.GeoCoder();
			geocoder.execute({ query : myVal }, function( result ){
				if(result.features.length > 0){
					var lat2 = Number(result.features[0].latlng.Lat);
					var lng2 = Number(result.features[0].latlng.Lon);
					var latlng2 = new google.maps.LatLng(lat2,lng2);
					//console.log(result.features[0].id);//Yahoo APIから取得した市町村コード
					map.setCenter(latlng2);
					map.setZoom(11);
				};
			});
		};

	});//d3.csv
	
	//CSV読み込み2（都道府県データ:47個）
	d3.csv("csv/kenbetsu3.csv", function(error, dataTsv){ 
	 	var maxData_2013_pref = 0;
	 	var maxData_2040_pref = 0;

		for(var i=0; i<dataTsv.length; i++){
			tsv_2013_pref[dataTsv[i].id] = parseFloat(dataTsv[i].rate2013);	//2013年(%)
			tsv_2040_pref[dataTsv[i].id] = parseFloat(dataTsv[i].rate2040);	//2040年(%)
			//console.log(dataTsv[i].id + "\t" + tsv_2013_pref[dataTsv[i].id] + "\t" + tsv_2040_pref[dataTsv[i].id] );//dataTsv[i].idがaomori
			tsv_2013_limit_pref[dataTsv[i].id] = parseInt(dataTsv[i].limitNum2013);	//2013年限界数
			tsv_2040_limit_pref[dataTsv[i].id] = parseInt(dataTsv[i].limitNum2040);	//2040年限界数
			//console.log(dataTsv[i].id + "\t" + tsv_2013_limit_pref[dataTsv[i].id] + "\t" + tsv_2040_limit_pref[dataTsv[i].id]);
			
			//d3.max()がおかしいので最大値を手動検索
			maxData_2013_pref = Math.max(maxData_2013_pref, tsv_2013_limit_pref[dataTsv[i].id]);
			maxData_2040_pref = Math.max(maxData_2040_pref, tsv_2040_limit_pref[dataTsv[i].id]);
		};

		//console.log("CSVファイルの都道府県数:" + Object.keys(tsv_2013_pref).length);
		maxData = Math.max(maxData_2013_pref, maxData_2040_pref);
		//console.log("maxData=\t" + maxData);
	});

	queue()
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/hokkaido.json") //TopoJSONの読み込み完了後main()へ
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/aomori.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/iwate.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/yamagata.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/akita.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/miyagi.json")
		.defer(d3.json, "topojson/fukushima.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/ibaraki.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/tochigi.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/nagano.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/yamanashi.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/gunma.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/saitama.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/chiba.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/tokyo.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/kanagawa.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/nigata.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/toyama.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/fukui.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/ishikawa.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/shizuoka.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/gifu.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/aichi.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/shiga.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/mie.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/nara.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/wakayama.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/kyoto.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/osaka.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/hyogo.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/okayama.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/hiroshima.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/tottori.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/shimane.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/yamaguchi.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/kagawa.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/tokushima.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/ehime.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/kochi.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/fukuoka.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/saga.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/nagasaki.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/oita.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/miyazaki.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/kumamoto.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/kagoshima.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/okinawa.json")
		.defer(d3.json, "/edu/edu2014/jinkogenEdu/svgMap/topojson/borders47.json")	//都道府県データもまとめて読み込む
		.await(main);


	function main(
		error, 
		hokkaido,
		aomori,
		iwate,
		yamagata,
		akita,
		miyagi,
		fukushima,
		ibaraki,
		tochigi,
		nagano,
		yamanashi,
		gunma,
		saitama,
		chiba,
		tokyo,
		kanagawa,
		nigata,
		toyama,
		fukui,
		ishikawa,
		shizuoka,
		gifu,
		aichi,
		shiga,
		mie,
		nara,
		wakayama,
		kyoto,
		osaka,
		hyogo,
		okayama,
		hiroshima,
		tottori,
		shimane,
		yamaguchi,
		kagawa,
		tokushima,
		ehime,
		kochi,
		fukuoka,
		saga,
		nagasaki,
		oita,
		miyazaki,
		kumamoto,
		kagoshima,
		okinawa,
		borders47
		){ //ここまでmain引数

		////////////////////// 47 loop（ここから）////////////////////
		//ループで回すために配列に入れている。
		var japan = [
			hokkaido,
			aomori,
			iwate,
			yamagata,
			akita,
			miyagi,
			fukushima,
			ibaraki,
			tochigi,
			nagano,
			yamanashi,
			gunma,
			saitama,
			chiba,
			tokyo,
			kanagawa,
			nigata,
			toyama,
			fukui,
			ishikawa,
			shizuoka,
			gifu,
			aichi,
			shiga,
			mie,
			nara,
			wakayama,
			kyoto,
			osaka,
			hyogo,
			okayama,
			hiroshima,
			tottori,
			shimane,
			yamaguchi,
			kagawa,
			tokushima,
			ehime,
			kochi,
			fukuoka,
			saga,
			nagasaki,
			oita,
			miyazaki,
			kumamoto,
			kagoshima,
			okinawa,
			borders47
		];


		for (var i=0; i<japan.length; i++){
			var tmp = topojson.feature(japan[i], japan[i].objects.object); 
			map.data.addGeoJson(tmp);
		};
		////////////////////// 47 loop（ここまで）////////////////////
		
		//描画スタイルを指定
		map.data.setStyle(styleFeature());	//リロード直後はchangeが発生しないので明示的に呼び出す。
		
	};//main()


	map.data.addListener('mouseover', mouseInToRegion);	//マウオオーバーイベント
	map.data.addListener('mouseout', mouseOutOfRegion);	//マウスアウトイベント

	// wire up the button
	var yearSwitch = document.getElementById('year-variable');	//年号の切り替え
	var prefSwitch = document.getElementById('pref-variable');	//表示モードの切り替え
	var locationSwitch = document.getElementById('latlng-variable');	//中心座標の切り替え

	//2013年と2040年で色を塗り分ける
	google.maps.event.addDomListener(yearSwitch, 'change', function() {


		//console.log(yearSwitch.options[yearSwitch.selectedIndex].value);
	 	//西暦を判別し、h2タグの内容を切り替える
		setYear();
		map.data.setStyle(styleFeature());	//変化があったときコール //0918消せない
	});

	//ズームレベルの変更を監視（ズームしたら市町村モード表示に切り替える）
	google.maps.event.addDomListener(map, 'zoom_changed', function() {

		//console.log("prevState=\t" + prevState);
		var zoomLevel = map.getZoom();

		if(zoomLevel >= initZoom + 2){	//初期状態から1回でもズームさせたら市町村表示モードに切り替え
			prefMode = false;	//市町村表示モードへ
			//前の表示状態が都道府県表示だったときだけstyleFeature()をコールする
			if(prevState == 'pref'){
				prevState = 'city';
				map.data.setStyle(styleFeature());
			};

		}else{
			prefMode = true;	//都道府県表示モードへ
			//前の表示状態が市町村表示だったときだけstyleFeature()をコールする
			if(prevState == 'city'){
				prevState = 'pref';
				map.data.setStyle(styleFeature());
			};
		};
	});

	//マウスオーバーで色を変更するためステートを定義。
	function mouseInToRegion(e) {
		var content;

		//塗り色を変えるために"hover"状態を設定
		e.feature.setProperty('state', 'hover');
		
		tooltip.style("visibility", "visible");

		content = '<div class="tt_style">';

		if(prefMode){
			//都道府県表示モード
			var pref = e.feature.getProperty('pref');
			
			//ツールチップに"undefined"が表示される現象を回避
			if(pref　== null){
				e.feature.setProperty('state', 'normal');	//"hover"状態をリセット
				//tooltip.style("visibility", "hidden");	//ツールチップを消す
				return;	//即抜ける
			}

			pref = getPrefName1(pref);

			content += '<p class="tt_pref">' + pref + '</p>';

			content += '<p class="tt_caption">「30人学校」の割合</p>';
			if(yearState == "YEAR2013"){
				content += '<p><span class="tt_year">2013年</span><span id="rate2013" class="tt_on">' + tsv_2013_pref[e.feature.getProperty('pref')] + ' %</span></p>';
				content += '<p><span class="tt_year">2040年</span><span id="rate2040" class="tt_off">' + tsv_2040_pref[e.feature.getProperty('pref')] + ' %</span></p>';
			}
			else if(yearState == "YEAR2040"){
				content += '<p><span class="tt_year">2013年</span><span id="rate2013" class="tt_off">' + tsv_2013_pref[e.feature.getProperty('pref')] + ' %</span></p>';
				content += '<p><span class="tt_year">2040年</span><span id="rate2040" class="tt_on">' + tsv_2040_pref[e.feature.getProperty('pref')] + ' %</span></p>';
			};

			content += '<p class="tt_caption tt_dotted">「30人学校」の数</p>';
			content += '<div class="graph">';
			///////////////////////2013年グラフ（ここから）///////////////////////////
			if(yearState == "YEAR2013"){	//jQueryのクラス切り替えが効かないので分岐追加（hover時にここのclass設定が優先される）
				content += '<div class="area2013 active">';
			}
			else if(yearState == "YEAR2040"){
				content += '<div class="area2013 not-active">';
			}
			content += '<div class="tt_year float_L">2013年</div>';
			content += '<div class="bar" style="width:';
			content += (tsv_2013_limit_pref[e.feature.getProperty('pref')] / maxData) * 80; //棒グラフの最大幅（北海道の369校）を100pxとした
			content += 'px;"></div>';
			content += '<div class="value">' + tsv_2013_limit_pref[e.feature.getProperty('pref')] + '</div>';
			content += '</div>';	//area2013
			///////////////////////2013年グラフ（ここまで）///////////////////////////
			content += '<div style="clear:both; margin-bottom:5px;"></div>';
			///////////////////////2040年グラフ（ここから）///////////////////////////
			if(yearState == "YEAR2013"){
				content += '<div class="area2040 not-active">';	
			}
			else if(yearState == "YEAR2040"){
				content += '<div class="area2040 active">';	
			};
			content += '<div class="tt_year float_L">2040年</div>';
			content += '<div class="bar" style="width:';
			content += (tsv_2040_limit_pref[e.feature.getProperty('pref')] / maxData) * 80; //棒グラフの最大幅（北海道の369校）を100pxとした
			content += 'px;"></div>';
			content += '<div class="value">' + tsv_2040_limit_pref[e.feature.getProperty('pref')] + '</div>';
			content += '</div>';	//area2040
			///////////////////////2040年グラフ（ここまで）///////////////////////////

			content += '</div>';	//graph

		}else{

			//市町村表示モード
			var cityCode = e.feature.getProperty('city_code');
			var prefCode;
			var pref;

			//ツールチップに"undefined"が表示される現象を回避
			if(cityCode == null){
				e.feature.setProperty('state', 'normal');	//"hover"状態をリセット
				//tooltip.style("visibility", "hidden");	//ツールチップを消す
				return;	//即抜ける
			};

			//都道府県名を市町村コードから判別
			if(cityCode.length == 4 ){//市町村コード桁数が４桁なら
				prefCode = Number(cityCode.substring(0, 1));
				pref = getPrefName2(prefCode);
			}else if(cityCode.length == 5){
				prefCode = Number(cityCode.substring(0, 2));
				pref = getPrefName3(prefCode);
			};

			content += '<p class="tt_pref">' + pref + '<br />';
			if(e.feature.getProperty('town1') != null){
				content += e.feature.getProperty('town1'); //town1もあれば表示
			}
			content += e.feature.getProperty('town2');
			content += "</p>";
			content += '<div class="tt_city">';
			if(pref == '福島県'){	//福島県は市町村単位のデータがないので表示を変える
				content += '<p class="tt_fukushima">「2040年の市町村別推計人口がなくデータを算出できず」</p>';
			}else{

				if(yearState == "YEAR2013"){
					if(tsv_2013_city[e.feature.getProperty('city_code')] == undefined){
						content += '<p><span class="tt_year">2013年</span><span id="rate2013" class="tt_on">データなし</p>';
					}else{
						content += '<p><span class="tt_year">2013年</span><span id="rate2013" class="tt_on">' + tsv_2013_city[e.feature.getProperty('city_code')] + ' %</span></p>';
					};
					if(tsv_2040_city[e.feature.getProperty('city_code')] == undefined){
						content += '<p><span class="tt_year">2040年</span><span id="rate2040" class="tt_off">データなし</p>';
					}else{
						content += '<p><span class="tt_year">2040年</span><span id="rate2040" class="tt_off">' + tsv_2040_city[e.feature.getProperty('city_code')] + ' %</span></p>';
					};
				}
				else if(yearState == "YEAR2040"){
					if(tsv_2013_city[e.feature.getProperty('city_code')] == undefined){
						content += '<p><span class="tt_year">2013年</span><span id="rate2013" class="tt_off">データなし</p>';
					}else{
						content += '<p><span class="tt_year">2013年</span><span id="rate2013" class="tt_off">' + tsv_2013_city[e.feature.getProperty('city_code')] + ' %</span></p>';
					};
					if(tsv_2040_city[e.feature.getProperty('city_code')] == undefined){
						content += '<p><span class="tt_year">2040年</span><span id="rate2040" class="tt_on">データなし</p>';
					}else{
						content += '<p><span class="tt_year">2040年</span><span id="rate2040" class="tt_on">' + tsv_2040_city[e.feature.getProperty('city_code')] + ' %</span></p>';
					};
				};

			};
			content += '</div>';
			//content += "<p>市町村コード: " + e.feature.getProperty('city_code') + "</p>";

		};

		content += '</div>';	//tt_style

		tooltip.html(content); //htmlを挿入
	}
	
	function mouseOutOfRegion(e) {
		e.feature.setProperty('state', 'normal');	//"hover"状態をリセット
		//tooltip.style("visibility", "hidden");	//ツールチップを消す
	};

	//HTMLの西暦を取得しyearStateを更新。さらにh2タグの内容を切り替え、ツールチップ内のクラスを付け替える。
	function setYear(){
 		yearState = "YEAR2040";
	 		//console.log("2040");
	 		//document.getElementById('map-heading').textContent = "2040年の場合";
	 		//ツールチップ内のcss切り替え
			$('#rate2013').addClass('tt_off');
			$('#rate2013').removeClass('tt_on');
			$('#rate2040').addClass('tt_on');
			$('#rate2040').removeClass('tt_off');

	 		$(".area2013").removeClass("active");
	 		$(".area2013").addClass("not-active");
			$(".area2040").removeClass("not-active");
	 		$(".area2040").addClass("active");
	 };

});


function getColor(rate){
	var tmpColor;
	if(rate >= 30.0){
		tmpColor = "#ff0000";	//濃い赤
	}
	else if(rate >= 20.0 && rate < 30.0){
		tmpColor = "#ff7777";	//薄い赤
	}
	else if(rate >= 10.0 && rate < 20.0){
		tmpColor = "#ffcccc";	//薄い赤
	}
	else{
		tmpColor = "#ffffff";	//白
	};

	return tmpColor;
};

function getPrefName1(pref){
	switch(pref){
		case 'hokkaido': pref = '北海道'; break;
		case 'aomori': pref = '青森県'; break;
		case 'iwate': pref = '岩手県'; break;
		case 'miyagi': pref = '宮城県'; break;
		case 'akita': pref = '秋田県'; break;
		case 'yamagata': pref = '山形県'; break;
		case 'fukushima': pref = '福島県'; break;
		case 'ibaraki': pref = '茨城県'; break;
		case 'tochigi': pref = '栃木県'; break;
		case 'gunma': pref = '群馬県'; break;
		case 'saitama': pref = '埼玉県'; break;
		case 'chiba': pref = '千葉県'; break;
		case 'tokyo': pref = '東京都'; break;
		case 'kanagawa': pref = '神奈川県'; break;
		case 'nigata': pref = '新潟県'; break;
		case 'toyama': pref = '富山県'; break;
		case 'ishikawa': pref = '石川県'; break;
		case 'fukui': pref = '福井県'; break;
		case 'yamanashi': pref = '山梨県'; break;
		case 'nagano': pref = '長野県'; break;
		case 'gifu': pref = '岐阜県'; break;
		case 'shizuoka': pref = '静岡県'; break;
		case 'aichi': pref = '愛知県'; break;
		case 'mie': pref = '三重県'; break;
		case 'shiga': pref = '滋賀県'; break;
		case 'kyoto': pref = '京都府'; break;
		case 'osaka': pref = '大阪府'; break;
		case 'hyogo': pref = '兵庫県'; break;
		case 'nara': pref = '奈良県'; break;
		case 'wakayama': pref = '和歌山県'; break;
		case 'tottori': pref = '鳥取県'; break;
		case 'shimane': pref = '島根県'; break;
		case 'okayama': pref = '岡山県'; break;
		case 'hiroshima': pref = '広島県'; break;
		case 'yamaguchi': pref = '山口県'; break;
		case 'tokushima': pref = '徳島県'; break;
		case 'kagawa': pref = '香川県'; break;
		case 'ehime': pref = '愛媛県'; break;
		case 'kochi': pref = '高知県'; break;
		case 'fukuoka': pref = '福岡県'; break;
		case 'saga': pref = '佐賀県'; break;
		case 'nagasaki': pref = '長崎県'; break;
		case 'kumamoto': pref = '熊本県'; break;
		case 'oita': pref = '大分県'; break;
		case 'miyazaki': pref = '宮崎県'; break;
		case 'kagoshima': pref = '鹿児島県'; break;
		case 'okinawa': pref = '沖縄県'; break;
		//default: alert("エラー"); break;
	};
	return pref;
};

function getPrefName2(prefCode){
	var pref;
	switch(prefCode){
		case 1: pref = '北海道'; break;
		case 2: pref = '青森県'; break;
		case 3: pref = '岩手県'; break;
		case 4: pref = '宮城県'; break;
		case 5: pref = '秋田県'; break;
		case 6: pref = '山形県'; break;
		case 7: pref = '福島県'; break;
		case 8: pref = '茨城県'; break;
		case 9: pref = '栃木県'; break;
	};

	return pref;
};

function getPrefName3(prefCode){
	var pref;
	switch(prefCode){
		case 10: pref = '群馬県'; break;
		case 11: pref = '埼玉県'; break;
		case 12: pref = '千葉県'; break;
		case 13: pref = '東京都'; break;
		case 14: pref = '神奈川県'; break;
		case 15: pref = '新潟県'; break;
		case 16: pref = '富山県'; break;
		case 17: pref = '石川県'; break;
		case 18: pref = '福井県'; break;
		case 19: pref = '山梨県'; break;
		case 20: pref = '長野県'; break;
		case 21: pref = '岐阜県'; break;
		case 22: pref = '静岡県'; break;
		case 23: pref = '愛知県'; break;
		case 24: pref = '三重県'; break;
		case 25: pref = '滋賀県'; break;
		case 26: pref = '京都府'; break;
		case 27: pref = '大阪府'; break;
		case 28: pref = '兵庫県'; break;
		case 29: pref = '奈良県'; break;
		case 30: pref = '和歌山県'; break;
		case 31: pref = '鳥取県'; break;
		case 32: pref = '島根県'; break;
		case 33: pref = '岡山県'; break;
		case 34: pref = '広島県'; break;
		case 35: pref = '山口県'; break;
		case 36: pref = '徳島県'; break;
		case 37: pref = '香川県'; break;
		case 38: pref = '愛媛県'; break;
		case 39: pref = '高知県'; break;
		case 40: pref = '福岡県'; break;
		case 41: pref = '佐賀県'; break;
		case 42: pref = '長崎県'; break;
		case 43: pref = '熊本県'; break;
		case 44: pref = '大分県'; break;
		case 45: pref = '宮崎県'; break;
		case 46: pref = '鹿児島県'; break;
		case 47: pref = '沖縄県'; break;
	}
	return pref;
};
