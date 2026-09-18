/* =====================================================================
 * gen1.js — โปเกม่อน Gen 1 ครบ 151 ตัว (สร้างอัตโนมัติ ห้ามแก้มือ)
 *
 * สร้างโดย tools/gen-pokedex.js จากไฟล์ CSV ของโปรเจกต์ PokeAPI
 * https://github.com/PokeAPI/pokeapi (data/v2/csv)
 *
 * ฟิลด์: n=ชื่อ jp=โรมาจิ t=ธาตุ s=[HP,Atk,Def,SpA,SpD,Spe]
 *        bst=ผลรวมสเตตัส from=ร่างก่อนหน้า to=ร่างถัดไป lg=ในตำนาน
 *        evo={t:เงื่อนไข, lv:เลเวลขั้นต่ำ}
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const DEX = [
  {id:1,n:'Bulbasaur',jp:'Fushigidane',t:['Grass','Poison'],s:[45,49,49,65,65,45],bst:318,from:0,to:[2],lg:0,cr:45,hb:3,evo:null},
  {id:2,n:'Ivysaur',jp:'Fushigisou',t:['Grass','Poison'],s:[60,62,63,80,80,60],bst:405,from:1,to:[3],lg:0,cr:45,hb:3,evo:{t:'level-up',lv:16}},
  {id:3,n:'Venusaur',jp:'Fushigibana',t:['Grass','Poison'],s:[80,82,83,100,100,80],bst:525,from:2,to:[],lg:0,cr:45,hb:3,evo:{t:'level-up',lv:32}},
  {id:4,n:'Charmander',jp:'Hitokage',t:['Fire'],s:[39,52,43,60,50,65],bst:309,from:0,to:[5],lg:0,cr:45,hb:4,evo:null},
  {id:5,n:'Charmeleon',jp:'Lizardo',t:['Fire'],s:[58,64,58,80,65,80],bst:405,from:4,to:[6],lg:0,cr:45,hb:4,evo:{t:'level-up',lv:16}},
  {id:6,n:'Charizard',jp:'Lizardon',t:['Fire','Flying'],s:[78,84,78,109,85,100],bst:534,from:5,to:[],lg:0,cr:45,hb:4,evo:{t:'level-up',lv:36}},
  {id:7,n:'Squirtle',jp:'Zenigame',t:['Water'],s:[44,48,65,50,64,43],bst:314,from:0,to:[8],lg:0,cr:45,hb:9,evo:null},
  {id:8,n:'Wartortle',jp:'Kameil',t:['Water'],s:[59,63,80,65,80,58],bst:405,from:7,to:[9],lg:0,cr:45,hb:9,evo:{t:'level-up',lv:16}},
  {id:9,n:'Blastoise',jp:'Kamex',t:['Water'],s:[79,83,100,85,105,78],bst:530,from:8,to:[],lg:0,cr:45,hb:9,evo:{t:'level-up',lv:36}},
  {id:10,n:'Caterpie',jp:'Caterpie',t:['Bug'],s:[45,30,35,20,20,45],bst:195,from:0,to:[11],lg:0,cr:255,hb:2,evo:null},
  {id:11,n:'Metapod',jp:'Transel',t:['Bug'],s:[50,20,55,25,25,30],bst:205,from:10,to:[12],lg:0,cr:120,hb:2,evo:{t:'level-up',lv:7}},
  {id:12,n:'Butterfree',jp:'Butterfree',t:['Bug','Flying'],s:[60,45,50,90,80,70],bst:395,from:11,to:[],lg:0,cr:45,hb:2,evo:{t:'level-up',lv:10}},
  {id:13,n:'Weedle',jp:'Beedle',t:['Bug','Poison'],s:[40,35,30,20,20,50],bst:195,from:0,to:[14],lg:0,cr:255,hb:2,evo:null},
  {id:14,n:'Kakuna',jp:'Cocoon',t:['Bug','Poison'],s:[45,25,50,25,25,35],bst:205,from:13,to:[15],lg:0,cr:120,hb:2,evo:{t:'level-up',lv:7}},
  {id:15,n:'Beedrill',jp:'Spear',t:['Bug','Poison'],s:[65,90,40,45,80,75],bst:395,from:14,to:[],lg:0,cr:45,hb:2,evo:{t:'level-up',lv:10}},
  {id:16,n:'Pidgey',jp:'Poppo',t:['Normal','Flying'],s:[40,45,40,35,35,56],bst:251,from:0,to:[17],lg:0,cr:255,hb:2,evo:null},
  {id:17,n:'Pidgeotto',jp:'Pigeon',t:['Normal','Flying'],s:[63,60,55,50,50,71],bst:349,from:16,to:[18],lg:0,cr:120,hb:2,evo:{t:'level-up',lv:18}},
  {id:18,n:'Pidgeot',jp:'Pigeot',t:['Normal','Flying'],s:[83,80,75,70,70,101],bst:479,from:17,to:[],lg:0,cr:45,hb:2,evo:{t:'level-up',lv:36}},
  {id:19,n:'Rattata',jp:'Koratta',t:['Normal'],s:[30,56,35,25,35,72],bst:253,from:0,to:[20],lg:0,cr:255,hb:3,evo:null},
  {id:20,n:'Raticate',jp:'Ratta',t:['Normal'],s:[55,81,60,50,70,97],bst:413,from:19,to:[],lg:0,cr:127,hb:3,evo:{t:'level-up',lv:20}},
  {id:21,n:'Spearow',jp:'Onisuzume',t:['Normal','Flying'],s:[40,60,30,31,31,70],bst:262,from:0,to:[22],lg:0,cr:255,hb:6,evo:null},
  {id:22,n:'Fearow',jp:'Onidrill',t:['Normal','Flying'],s:[65,90,65,61,61,100],bst:442,from:21,to:[],lg:0,cr:90,hb:6,evo:{t:'level-up',lv:20}},
  {id:23,n:'Ekans',jp:'Arbo',t:['Poison'],s:[35,60,44,40,54,55],bst:288,from:0,to:[24],lg:0,cr:255,hb:3,evo:null},
  {id:24,n:'Arbok',jp:'Arbok',t:['Poison'],s:[60,95,69,65,79,80],bst:448,from:23,to:[],lg:0,cr:90,hb:3,evo:{t:'level-up',lv:22}},
  {id:25,n:'Pikachu',jp:'Pikachu',t:['Electric'],s:[35,55,40,50,50,90],bst:320,from:0,to:[26],lg:0,cr:190,hb:2,evo:{t:'level-up'}},
  {id:26,n:'Raichu',jp:'Raichu',t:['Electric'],s:[60,90,55,90,80,110],bst:485,from:25,to:[],lg:0,cr:75,hb:2,evo:{t:'use-item'}},
  {id:27,n:'Sandshrew',jp:'Sand',t:['Ground'],s:[50,75,85,20,30,40],bst:300,from:0,to:[28],lg:0,cr:255,hb:6,evo:null},
  {id:28,n:'Sandslash',jp:'Sandpan',t:['Ground'],s:[75,100,110,45,55,65],bst:450,from:27,to:[],lg:0,cr:90,hb:6,evo:{t:'level-up',lv:22}},
  {id:29,n:'Nidoran♀',jp:'Nidoran♀',t:['Poison'],s:[55,47,52,40,40,41],bst:275,from:0,to:[30],lg:0,cr:235,hb:3,evo:null},
  {id:30,n:'Nidorina',jp:'Nidorina',t:['Poison'],s:[70,62,67,55,55,56],bst:365,from:29,to:[31],lg:0,cr:120,hb:3,evo:{t:'level-up',lv:16}},
  {id:31,n:'Nidoqueen',jp:'Nidoqueen',t:['Poison','Ground'],s:[90,92,87,75,85,76],bst:505,from:30,to:[],lg:0,cr:45,hb:3,evo:{t:'use-item'}},
  {id:32,n:'Nidoran♂',jp:'Nidoran♂',t:['Poison'],s:[46,57,40,40,40,50],bst:273,from:0,to:[33],lg:0,cr:235,hb:3,evo:null},
  {id:33,n:'Nidorino',jp:'Nidorino',t:['Poison'],s:[61,72,57,55,55,65],bst:365,from:32,to:[34],lg:0,cr:120,hb:3,evo:{t:'level-up',lv:16}},
  {id:34,n:'Nidoking',jp:'Nidoking',t:['Poison','Ground'],s:[81,102,77,85,75,85],bst:505,from:33,to:[],lg:0,cr:45,hb:3,evo:{t:'use-item'}},
  {id:35,n:'Clefairy',jp:'Pippi',t:['Fairy'],s:[70,45,48,60,65,35],bst:323,from:0,to:[36],lg:0,cr:150,hb:4,evo:{t:'level-up'}},
  {id:36,n:'Clefable',jp:'Pixy',t:['Fairy'],s:[95,70,73,95,90,60],bst:483,from:35,to:[],lg:0,cr:25,hb:4,evo:{t:'use-item'}},
  {id:37,n:'Vulpix',jp:'Rokon',t:['Fire'],s:[38,41,40,50,65,65],bst:299,from:0,to:[38],lg:0,cr:190,hb:3,evo:null},
  {id:38,n:'Ninetales',jp:'Kyukon',t:['Fire'],s:[73,76,75,81,100,100],bst:505,from:37,to:[],lg:0,cr:75,hb:3,evo:{t:'use-item'}},
  {id:39,n:'Jigglypuff',jp:'Purin',t:['Normal','Fairy'],s:[115,45,20,45,25,20],bst:270,from:0,to:[40],lg:0,cr:170,hb:3,evo:{t:'level-up'}},
  {id:40,n:'Wigglytuff',jp:'Pukurin',t:['Normal','Fairy'],s:[140,70,45,85,50,45],bst:435,from:39,to:[],lg:0,cr:50,hb:3,evo:{t:'use-item'}},
  {id:41,n:'Zubat',jp:'Zubat',t:['Poison','Flying'],s:[40,45,35,30,40,55],bst:245,from:0,to:[42],lg:0,cr:255,hb:1,evo:null},
  {id:42,n:'Golbat',jp:'Golbat',t:['Poison','Flying'],s:[75,80,70,65,75,90],bst:455,from:41,to:[],lg:0,cr:90,hb:1,evo:{t:'level-up',lv:22}},
  {id:43,n:'Oddish',jp:'Nazonokusa',t:['Grass','Poison'],s:[45,50,55,75,65,30],bst:320,from:0,to:[44],lg:0,cr:255,hb:3,evo:null},
  {id:44,n:'Gloom',jp:'Kusaihana',t:['Grass','Poison'],s:[60,65,70,85,75,40],bst:395,from:43,to:[45],lg:0,cr:120,hb:3,evo:{t:'level-up',lv:21}},
  {id:45,n:'Vileplume',jp:'Ruffresia',t:['Grass','Poison'],s:[75,80,85,110,90,50],bst:490,from:44,to:[],lg:0,cr:45,hb:3,evo:{t:'use-item'}},
  {id:46,n:'Paras',jp:'Paras',t:['Bug','Grass'],s:[35,70,55,45,55,25],bst:285,from:0,to:[47],lg:0,cr:190,hb:2,evo:null},
  {id:47,n:'Parasect',jp:'Parasect',t:['Bug','Grass'],s:[60,95,80,60,80,30],bst:405,from:46,to:[],lg:0,cr:75,hb:2,evo:{t:'level-up',lv:24}},
  {id:48,n:'Venonat',jp:'Kongpang',t:['Bug','Poison'],s:[60,55,50,40,55,45],bst:305,from:0,to:[49],lg:0,cr:190,hb:2,evo:null},
  {id:49,n:'Venomoth',jp:'Morphon',t:['Bug','Poison'],s:[70,65,60,90,75,90],bst:450,from:48,to:[],lg:0,cr:75,hb:2,evo:{t:'level-up',lv:31}},
  {id:50,n:'Diglett',jp:'Digda',t:['Ground'],s:[10,55,25,35,45,95],bst:265,from:0,to:[51],lg:0,cr:255,hb:1,evo:null},
  {id:51,n:'Dugtrio',jp:'Dugtrio',t:['Ground'],s:[35,100,50,50,70,120],bst:425,from:50,to:[],lg:0,cr:50,hb:1,evo:{t:'level-up',lv:26}},
  {id:52,n:'Meowth',jp:'Nyarth',t:['Normal'],s:[40,45,35,40,40,90],bst:290,from:0,to:[53],lg:0,cr:255,hb:8,evo:null},
  {id:53,n:'Persian',jp:'Persian',t:['Normal'],s:[65,70,60,65,65,115],bst:440,from:52,to:[],lg:0,cr:90,hb:8,evo:{t:'level-up',lv:28}},
  {id:54,n:'Psyduck',jp:'Koduck',t:['Water'],s:[50,52,48,65,50,55],bst:320,from:0,to:[55],lg:0,cr:190,hb:9,evo:null},
  {id:55,n:'Golduck',jp:'Golduck',t:['Water'],s:[80,82,78,95,80,85],bst:500,from:54,to:[],lg:0,cr:75,hb:9,evo:{t:'level-up',lv:33}},
  {id:56,n:'Mankey',jp:'Mankey',t:['Fighting'],s:[40,80,35,35,45,70],bst:305,from:0,to:[57],lg:0,cr:190,hb:4,evo:null},
  {id:57,n:'Primeape',jp:'Okorizaru',t:['Fighting'],s:[65,105,60,60,70,95],bst:455,from:56,to:[],lg:0,cr:75,hb:4,evo:{t:'level-up',lv:28}},
  {id:58,n:'Growlithe',jp:'Gardie',t:['Fire'],s:[55,70,45,70,50,60],bst:350,from:0,to:[59],lg:0,cr:190,hb:3,evo:null},
  {id:59,n:'Arcanine',jp:'Windie',t:['Fire'],s:[90,110,80,100,80,95],bst:555,from:58,to:[],lg:0,cr:75,hb:3,evo:{t:'use-item'}},
  {id:60,n:'Poliwag',jp:'Nyoromo',t:['Water'],s:[40,50,40,40,40,90],bst:300,from:0,to:[61],lg:0,cr:255,hb:9,evo:null},
  {id:61,n:'Poliwhirl',jp:'Nyorozo',t:['Water'],s:[65,65,65,50,50,90],bst:385,from:60,to:[62],lg:0,cr:120,hb:9,evo:{t:'level-up',lv:25}},
  {id:62,n:'Poliwrath',jp:'Nyorobon',t:['Water','Fighting'],s:[90,95,95,70,90,70],bst:510,from:61,to:[],lg:0,cr:45,hb:9,evo:{t:'use-item'}},
  {id:63,n:'Abra',jp:'Casey',t:['Psychic'],s:[25,20,15,105,55,90],bst:310,from:0,to:[64],lg:0,cr:200,hb:8,evo:null},
  {id:64,n:'Kadabra',jp:'Yungerer',t:['Psychic'],s:[40,35,30,120,70,105],bst:400,from:63,to:[65],lg:0,cr:100,hb:8,evo:{t:'level-up',lv:16}},
  {id:65,n:'Alakazam',jp:'Foodin',t:['Psychic'],s:[55,50,45,135,95,120],bst:500,from:64,to:[],lg:0,cr:50,hb:8,evo:{t:'trade'}},
  {id:66,n:'Machop',jp:'Wanriky',t:['Fighting'],s:[70,80,50,35,35,35],bst:305,from:0,to:[67],lg:0,cr:180,hb:4,evo:null},
  {id:67,n:'Machoke',jp:'Goriky',t:['Fighting'],s:[80,100,70,50,60,45],bst:405,from:66,to:[68],lg:0,cr:90,hb:4,evo:{t:'level-up',lv:28}},
  {id:68,n:'Machamp',jp:'Kairiky',t:['Fighting'],s:[90,130,80,65,85,55],bst:505,from:67,to:[],lg:0,cr:45,hb:4,evo:{t:'trade'}},
  {id:69,n:'Bellsprout',jp:'Madatsubomi',t:['Grass','Poison'],s:[50,75,35,70,30,40],bst:300,from:0,to:[70],lg:0,cr:255,hb:2,evo:null},
  {id:70,n:'Weepinbell',jp:'Utsudon',t:['Grass','Poison'],s:[65,90,50,85,45,55],bst:390,from:69,to:[71],lg:0,cr:120,hb:2,evo:{t:'level-up',lv:21}},
  {id:71,n:'Victreebel',jp:'Utsubot',t:['Grass','Poison'],s:[80,105,65,100,70,70],bst:490,from:70,to:[],lg:0,cr:45,hb:2,evo:{t:'use-item'}},
  {id:72,n:'Tentacool',jp:'Menokurage',t:['Water','Poison'],s:[40,40,35,50,100,70],bst:335,from:0,to:[73],lg:0,cr:190,hb:7,evo:null},
  {id:73,n:'Tentacruel',jp:'Dokukurage',t:['Water','Poison'],s:[80,70,65,80,120,100],bst:515,from:72,to:[],lg:0,cr:60,hb:7,evo:{t:'level-up',lv:30}},
  {id:74,n:'Geodude',jp:'Isitsubute',t:['Rock','Ground'],s:[40,80,100,30,30,20],bst:300,from:0,to:[75],lg:0,cr:255,hb:4,evo:null},
  {id:75,n:'Graveler',jp:'Golone',t:['Rock','Ground'],s:[55,95,115,45,45,35],bst:390,from:74,to:[76],lg:0,cr:120,hb:4,evo:{t:'level-up',lv:25}},
  {id:76,n:'Golem',jp:'Golonya',t:['Rock','Ground'],s:[80,120,130,55,65,45],bst:495,from:75,to:[],lg:0,cr:45,hb:4,evo:{t:'trade'}},
  {id:77,n:'Ponyta',jp:'Ponyta',t:['Fire'],s:[50,85,55,65,65,90],bst:410,from:0,to:[78],lg:0,cr:190,hb:3,evo:null},
  {id:78,n:'Rapidash',jp:'Gallop',t:['Fire'],s:[65,100,70,80,80,105],bst:500,from:77,to:[],lg:0,cr:60,hb:3,evo:{t:'level-up',lv:40}},
  {id:79,n:'Slowpoke',jp:'Yadon',t:['Water','Psychic'],s:[90,65,65,40,40,15],bst:315,from:0,to:[80],lg:0,cr:190,hb:9,evo:null},
  {id:80,n:'Slowbro',jp:'Yadoran',t:['Water','Psychic'],s:[95,75,110,100,80,30],bst:490,from:79,to:[],lg:0,cr:75,hb:9,evo:{t:'level-up',lv:37}},
  {id:81,n:'Magnemite',jp:'Coil',t:['Electric','Steel'],s:[25,35,70,95,55,45],bst:325,from:0,to:[82],lg:0,cr:190,hb:6,evo:null},
  {id:82,n:'Magneton',jp:'Rarecoil',t:['Electric','Steel'],s:[50,60,95,120,70,70],bst:465,from:81,to:[],lg:0,cr:60,hb:6,evo:{t:'level-up',lv:30}},
  {id:83,n:'Farfetchd',jp:'Kamonegi',t:['Normal','Flying'],s:[52,90,55,58,62,60],bst:377,from:0,to:[],lg:0,cr:45,hb:3,evo:null},
  {id:84,n:'Doduo',jp:'Dodo',t:['Normal','Flying'],s:[35,85,45,35,35,75],bst:310,from:0,to:[85],lg:0,cr:190,hb:3,evo:null},
  {id:85,n:'Dodrio',jp:'Dodorio',t:['Normal','Flying'],s:[60,110,70,60,60,110],bst:470,from:84,to:[],lg:0,cr:45,hb:3,evo:{t:'level-up',lv:31}},
  {id:86,n:'Seel',jp:'Pawou',t:['Water'],s:[65,45,55,45,70,45],bst:325,from:0,to:[87],lg:0,cr:190,hb:7,evo:null},
  {id:87,n:'Dewgong',jp:'Jugon',t:['Water','Ice'],s:[90,70,80,70,95,70],bst:475,from:86,to:[],lg:0,cr:75,hb:7,evo:{t:'level-up',lv:34}},
  {id:88,n:'Grimer',jp:'Betbeter',t:['Poison'],s:[80,80,50,40,50,25],bst:325,from:0,to:[89],lg:0,cr:190,hb:8,evo:null},
  {id:89,n:'Muk',jp:'Betbeton',t:['Poison'],s:[105,105,75,65,100,50],bst:500,from:88,to:[],lg:0,cr:75,hb:8,evo:{t:'level-up',lv:38}},
  {id:90,n:'Shellder',jp:'Shellder',t:['Water'],s:[30,65,100,45,25,40],bst:305,from:0,to:[91],lg:0,cr:190,hb:7,evo:null},
  {id:91,n:'Cloyster',jp:'Parshen',t:['Water','Ice'],s:[50,95,180,85,45,70],bst:525,from:90,to:[],lg:0,cr:60,hb:7,evo:{t:'use-item'}},
  {id:92,n:'Gastly',jp:'Ghos',t:['Ghost','Poison'],s:[30,35,30,100,35,80],bst:310,from:0,to:[93],lg:0,cr:190,hb:1,evo:null},
  {id:93,n:'Haunter',jp:'Ghost',t:['Ghost','Poison'],s:[45,50,45,115,55,95],bst:405,from:92,to:[94],lg:0,cr:90,hb:1,evo:{t:'level-up',lv:25}},
  {id:94,n:'Gengar',jp:'Gangar',t:['Ghost','Poison'],s:[60,65,60,130,75,110],bst:500,from:93,to:[],lg:0,cr:45,hb:1,evo:{t:'trade'}},
  {id:95,n:'Onix',jp:'Iwark',t:['Rock','Ground'],s:[35,45,160,30,45,70],bst:385,from:0,to:[],lg:0,cr:45,hb:1,evo:null},
  {id:96,n:'Drowzee',jp:'Sleepe',t:['Psychic'],s:[60,48,45,43,90,42],bst:328,from:0,to:[97],lg:0,cr:190,hb:3,evo:null},
  {id:97,n:'Hypno',jp:'Sleeper',t:['Psychic'],s:[85,73,70,73,115,67],bst:483,from:96,to:[],lg:0,cr:75,hb:3,evo:{t:'level-up',lv:26}},
  {id:98,n:'Krabby',jp:'Crab',t:['Water'],s:[30,105,90,25,25,50],bst:325,from:0,to:[99],lg:0,cr:225,hb:9,evo:null},
  {id:99,n:'Kingler',jp:'Kingler',t:['Water'],s:[55,130,115,50,50,75],bst:475,from:98,to:[],lg:0,cr:60,hb:9,evo:{t:'level-up',lv:28}},
  {id:100,n:'Voltorb',jp:'Biriridama',t:['Electric'],s:[40,30,50,55,55,100],bst:330,from:0,to:[101],lg:0,cr:190,hb:8,evo:null},
  {id:101,n:'Electrode',jp:'Marumine',t:['Electric'],s:[60,50,70,80,80,150],bst:490,from:100,to:[],lg:0,cr:60,hb:8,evo:{t:'level-up',lv:30}},
  {id:102,n:'Exeggcute',jp:'Tamatama',t:['Grass','Psychic'],s:[60,40,80,60,45,40],bst:325,from:0,to:[103],lg:0,cr:90,hb:2,evo:null},
  {id:103,n:'Exeggutor',jp:'Nassy',t:['Grass','Psychic'],s:[95,95,85,125,75,55],bst:530,from:102,to:[],lg:0,cr:45,hb:2,evo:{t:'use-item'}},
  {id:104,n:'Cubone',jp:'Karakara',t:['Ground'],s:[50,50,95,40,50,35],bst:320,from:0,to:[105],lg:0,cr:190,hb:4,evo:null},
  {id:105,n:'Marowak',jp:'Garagara',t:['Ground'],s:[60,80,110,50,80,45],bst:425,from:104,to:[],lg:0,cr:75,hb:4,evo:{t:'level-up',lv:28}},
  {id:106,n:'Hitmonlee',jp:'Sawamular',t:['Fighting'],s:[50,120,53,35,110,87],bst:455,from:0,to:[],lg:0,cr:45,hb:8,evo:{t:'level-up',lv:20}},
  {id:107,n:'Hitmonchan',jp:'Ebiwalar',t:['Fighting'],s:[50,105,79,35,110,76],bst:455,from:0,to:[],lg:0,cr:45,hb:8,evo:{t:'level-up',lv:20}},
  {id:108,n:'Lickitung',jp:'Beroringa',t:['Normal'],s:[90,55,75,60,75,30],bst:385,from:0,to:[],lg:0,cr:45,hb:3,evo:null},
  {id:109,n:'Koffing',jp:'Dogars',t:['Poison'],s:[40,65,95,60,45,35],bst:340,from:0,to:[110],lg:0,cr:190,hb:8,evo:null},
  {id:110,n:'Weezing',jp:'Matadogas',t:['Poison'],s:[65,90,120,85,70,60],bst:490,from:109,to:[],lg:0,cr:60,hb:8,evo:{t:'level-up',lv:35}},
  {id:111,n:'Rhyhorn',jp:'Sihorn',t:['Ground','Rock'],s:[80,85,95,30,30,25],bst:345,from:0,to:[112],lg:0,cr:120,hb:6,evo:null},
  {id:112,n:'Rhydon',jp:'Sidon',t:['Ground','Rock'],s:[105,130,120,45,45,40],bst:485,from:111,to:[],lg:0,cr:60,hb:6,evo:{t:'level-up',lv:42}},
  {id:113,n:'Chansey',jp:'Lucky',t:['Normal'],s:[250,5,5,35,105,50],bst:450,from:0,to:[],lg:0,cr:30,hb:8,evo:{t:'level-up'}},
  {id:114,n:'Tangela',jp:'Monjara',t:['Grass'],s:[65,55,115,100,40,60],bst:435,from:0,to:[],lg:0,cr:45,hb:3,evo:null},
  {id:115,n:'Kangaskhan',jp:'Garura',t:['Normal'],s:[105,95,80,40,80,90],bst:490,from:0,to:[],lg:0,cr:45,hb:3,evo:null},
  {id:116,n:'Horsea',jp:'Tattu',t:['Water'],s:[30,40,70,70,25,60],bst:295,from:0,to:[117],lg:0,cr:225,hb:7,evo:null},
  {id:117,n:'Seadra',jp:'Seadra',t:['Water'],s:[55,65,95,95,45,85],bst:440,from:116,to:[],lg:0,cr:75,hb:7,evo:{t:'level-up',lv:32}},
  {id:118,n:'Goldeen',jp:'Tosakinto',t:['Water'],s:[45,67,60,35,50,63],bst:320,from:0,to:[119],lg:0,cr:225,hb:9,evo:null},
  {id:119,n:'Seaking',jp:'Azumao',t:['Water'],s:[80,92,65,65,80,68],bst:450,from:118,to:[],lg:0,cr:60,hb:9,evo:{t:'level-up',lv:33}},
  {id:120,n:'Staryu',jp:'Hitodeman',t:['Water'],s:[30,45,55,70,55,85],bst:340,from:0,to:[121],lg:0,cr:225,hb:7,evo:null},
  {id:121,n:'Starmie',jp:'Starmie',t:['Water','Psychic'],s:[60,75,85,100,85,115],bst:520,from:120,to:[],lg:0,cr:60,hb:7,evo:{t:'use-item'}},
  {id:122,n:'Mr-mime',jp:'Barrierd',t:['Psychic','Fairy'],s:[40,45,65,100,120,90],bst:460,from:0,to:[],lg:0,cr:45,hb:8,evo:{t:'level-up'}},
  {id:123,n:'Scyther',jp:'Strike',t:['Bug','Flying'],s:[70,110,80,55,80,105],bst:500,from:0,to:[],lg:0,cr:45,hb:3,evo:null},
  {id:124,n:'Jynx',jp:'Rougela',t:['Ice','Psychic'],s:[65,50,35,115,95,95],bst:455,from:0,to:[],lg:0,cr:45,hb:8,evo:{t:'level-up',lv:30}},
  {id:125,n:'Electabuzz',jp:'Eleboo',t:['Electric'],s:[65,83,57,95,85,105],bst:490,from:0,to:[],lg:0,cr:45,hb:3,evo:{t:'level-up',lv:30}},
  {id:126,n:'Magmar',jp:'Boober',t:['Fire'],s:[65,95,57,100,85,93],bst:495,from:0,to:[],lg:0,cr:45,hb:4,evo:{t:'level-up',lv:30}},
  {id:127,n:'Pinsir',jp:'Kailios',t:['Bug'],s:[65,125,100,55,70,85],bst:500,from:0,to:[],lg:0,cr:45,hb:2,evo:null},
  {id:128,n:'Tauros',jp:'Kentauros',t:['Normal'],s:[75,100,95,40,70,110],bst:490,from:0,to:[],lg:0,cr:45,hb:3,evo:null},
  {id:129,n:'Magikarp',jp:'Koiking',t:['Water'],s:[20,10,55,15,20,80],bst:200,from:0,to:[130],lg:0,cr:255,hb:9,evo:null},
  {id:130,n:'Gyarados',jp:'Gyarados',t:['Water','Flying'],s:[95,125,79,60,100,81],bst:540,from:129,to:[],lg:0,cr:45,hb:9,evo:{t:'level-up',lv:20}},
  {id:131,n:'Lapras',jp:'Laplace',t:['Water','Ice'],s:[130,85,80,85,95,60],bst:535,from:0,to:[],lg:0,cr:45,hb:7,evo:null},
  {id:132,n:'Ditto',jp:'Metamon',t:['Normal'],s:[48,48,48,48,48,48],bst:288,from:0,to:[],lg:0,cr:35,hb:8,evo:null},
  {id:133,n:'Eevee',jp:'Eievui',t:['Normal'],s:[55,55,50,45,65,55],bst:325,from:0,to:[134,135,136],lg:0,cr:45,hb:8,evo:null},
  {id:134,n:'Vaporeon',jp:'Showers',t:['Water'],s:[130,65,60,110,95,65],bst:525,from:133,to:[],lg:0,cr:45,hb:8,evo:{t:'use-item'}},
  {id:135,n:'Jolteon',jp:'Thunders',t:['Electric'],s:[65,65,60,110,95,130],bst:525,from:133,to:[],lg:0,cr:45,hb:8,evo:{t:'use-item'}},
  {id:136,n:'Flareon',jp:'Booster',t:['Fire'],s:[65,130,60,95,110,65],bst:525,from:133,to:[],lg:0,cr:45,hb:8,evo:{t:'use-item'}},
  {id:137,n:'Porygon',jp:'Porygon',t:['Normal'],s:[65,60,70,85,75,40],bst:395,from:0,to:[],lg:0,cr:45,hb:8,evo:null},
  {id:138,n:'Omanyte',jp:'Omnite',t:['Rock','Water'],s:[35,40,100,90,55,35],bst:355,from:0,to:[139],lg:0,cr:45,hb:7,evo:null},
  {id:139,n:'Omastar',jp:'Omstar',t:['Rock','Water'],s:[70,60,125,115,70,55],bst:495,from:138,to:[],lg:0,cr:45,hb:7,evo:{t:'level-up',lv:40}},
  {id:140,n:'Kabuto',jp:'Kabuto',t:['Rock','Water'],s:[30,80,90,55,45,55],bst:355,from:0,to:[141],lg:0,cr:45,hb:7,evo:null},
  {id:141,n:'Kabutops',jp:'Kabutops',t:['Rock','Water'],s:[60,115,105,65,70,80],bst:495,from:140,to:[],lg:0,cr:45,hb:7,evo:{t:'level-up',lv:40}},
  {id:142,n:'Aerodactyl',jp:'Ptera',t:['Rock','Flying'],s:[80,105,65,60,75,130],bst:515,from:0,to:[],lg:0,cr:45,hb:4,evo:null},
  {id:143,n:'Snorlax',jp:'Kabigon',t:['Normal'],s:[160,110,65,65,110,30],bst:540,from:0,to:[],lg:0,cr:25,hb:4,evo:{t:'level-up'}},
  {id:144,n:'Articuno',jp:'Freezer',t:['Ice','Flying'],s:[90,85,100,95,125,85],bst:580,from:0,to:[],lg:1,cr:3,hb:5,evo:null},
  {id:145,n:'Zapdos',jp:'Thunder',t:['Electric','Flying'],s:[90,90,85,125,90,100],bst:580,from:0,to:[],lg:1,cr:3,hb:5,evo:null},
  {id:146,n:'Moltres',jp:'Fire',t:['Fire','Flying'],s:[90,100,90,125,85,90],bst:580,from:0,to:[],lg:1,cr:3,hb:5,evo:null},
  {id:147,n:'Dratini',jp:'Miniryu',t:['Dragon'],s:[41,64,45,50,50,50],bst:300,from:0,to:[148],lg:0,cr:45,hb:9,evo:null},
  {id:148,n:'Dragonair',jp:'Hakuryu',t:['Dragon'],s:[61,84,65,70,70,70],bst:420,from:147,to:[149],lg:0,cr:45,hb:9,evo:{t:'level-up',lv:30}},
  {id:149,n:'Dragonite',jp:'Kairyu',t:['Dragon','Flying'],s:[91,134,95,100,100,80],bst:600,from:148,to:[],lg:0,cr:45,hb:9,evo:{t:'level-up',lv:55}},
  {id:150,n:'Mewtwo',jp:'Mewtwo',t:['Psychic'],s:[106,110,90,154,90,130],bst:680,from:0,to:[],lg:1,cr:3,hb:5,evo:null},
  {id:151,n:'Mew',jp:'Mew',t:['Psychic'],s:[100,100,100,100,100,100],bst:600,from:0,to:[],lg:1,cr:45,hb:5,evo:null}
  ];

  /* ร่างเมก้า: form=id ของสไปรท์, of=สายพันธุ์เจ้าของ, v=รุ่น X/Y, stone=ชื่อหิน */
  const MEGA = [
  {form:10033,of:3,n:'Mega Venusaur',v:'',t:['Grass','Poison'],s:[80,100,123,122,120,80],bst:625,stone:'Venusaurite'},
  {form:10034,of:6,n:'Mega Charizard X',v:'X',t:['Fire','Dragon'],s:[78,130,111,130,85,100],bst:634,stone:'Charizardite'},
  {form:10035,of:6,n:'Mega Charizard Y',v:'Y',t:['Fire','Flying'],s:[78,104,78,159,115,100],bst:634,stone:'Charizardite'},
  {form:10036,of:9,n:'Mega Blastoise',v:'',t:['Water'],s:[79,103,120,135,115,78],bst:630,stone:'Blastoisinite'},
  {form:10090,of:15,n:'Mega Beedrill',v:'',t:['Bug','Poison'],s:[65,150,40,15,80,145],bst:495,stone:'Beedrillite'},
  {form:10073,of:18,n:'Mega Pidgeot',v:'',t:['Normal','Flying'],s:[83,80,80,135,80,121],bst:579,stone:'Pidgeotite'},
  {form:10037,of:65,n:'Mega Alakazam',v:'',t:['Psychic'],s:[55,50,65,175,105,150],bst:600,stone:'Alakazite'},
  {form:10071,of:80,n:'Mega Slowbro',v:'',t:['Water','Psychic'],s:[95,75,180,130,80,30],bst:590,stone:'Slowbronite'},
  {form:10038,of:94,n:'Mega Gengar',v:'',t:['Ghost','Poison'],s:[60,65,80,170,95,130],bst:600,stone:'Gengarite'},
  {form:10039,of:115,n:'Mega Kangaskhan',v:'',t:['Normal'],s:[105,125,100,60,100,100],bst:590,stone:'Kangaskhanite'},
  {form:10040,of:127,n:'Mega Pinsir',v:'',t:['Bug','Flying'],s:[65,155,120,65,90,105],bst:600,stone:'Pinsirite'},
  {form:10041,of:130,n:'Mega Gyarados',v:'',t:['Water','Dark'],s:[95,155,109,70,130,81],bst:640,stone:'Gyaradosite'},
  {form:10042,of:142,n:'Mega Aerodactyl',v:'',t:['Rock','Flying'],s:[80,135,85,70,95,150],bst:615,stone:'Aerodactylite'},
  {form:10043,of:150,n:'Mega Mewtwo X',v:'X',t:['Psychic','Fighting'],s:[106,190,100,154,100,130],bst:780,stone:'Mewtwonite'},
  {form:10044,of:150,n:'Mega Mewtwo Y',v:'Y',t:['Psychic'],s:[106,150,70,194,120,140],bst:780,stone:'Mewtwonite'}
  ];

  const BY_ID = new Map(DEX.map(d => [d.id, d]));
  const MEGA_BY_SPECIES = new Map();
  for (const m of MEGA) {
    if (!MEGA_BY_SPECIES.has(m.of)) MEGA_BY_SPECIES.set(m.of, []);
    MEGA_BY_SPECIES.get(m.of).push(m);
  }

  PTD.DEX = DEX;
  PTD.MEGA = MEGA;
  PTD.dex = (id) => BY_ID.get(id);
  // คืนรายชื่อร่างเมก้าของสายพันธุ์นั้น (Charizard กับ Mewtwo มีสองร่าง)
  PTD.megasOf = (speciesId) => MEGA_BY_SPECIES.get(speciesId) || [];
  PTD.hasMega = (speciesId) => MEGA_BY_SPECIES.has(speciesId);
  PTD.MEGA_SPECIES = [...MEGA_BY_SPECIES.keys()];
  // ร่างเริ่มต้นของสาย = ตัวที่ไม่มีร่างก่อนหน้า
  PTD.BASE_FORMS = DEX.filter(d => !d.from).map(d => d.id);
  // ไล่สายวิวัฒนาการจาก id ที่ให้มาไปจนสุด (เลือกกิ่งแรกเสมอ)
  PTD.line = function (id) {
    const out = [];
    let cur = BY_ID.get(id);
    while (cur) { out.push(cur.id); cur = cur.to.length ? BY_ID.get(cur.to[0]) : null; }
    return out;
  };
})(window.PTD = window.PTD || {});
