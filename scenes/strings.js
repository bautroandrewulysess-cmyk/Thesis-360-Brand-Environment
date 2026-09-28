// Central UI string table. One entry per user-visible string.
// Read through Scene.prototype.t(key) / window.t(key) — never index this directly.
// 'bis' values are intentionally empty; t() falls back to 'en' until they are filled.
// streetView arrow labels are deliberately NOT here, and must never be added:
// they are control-flow identifiers, not display text. Nothing renders them to
// the player (those arrows are flat untextured discs) — the string itself is the
// discriminator, read via .includes('Back') and === comparisons to pick arrow
// material colour and drive forward/back selection. Translating them would break
// navigation for zero visible benefit. See the warning above this.positions in
// scenes/streetView.js.

window.Strings = {
    'cafe.yfc-board.label': { en: 'YFC Board', bis: 'YFC Board' },
    'cafe.yfc-board.description': { en: 'Aside from the owners\' passion in bringing the farm to the cup, they bring the same passion in dedicating their time in building a Christ-centered community. For over ten years, they faithfully serve as Chapter 5 coordinators of the Youth for Christ Pangantucan Chapter, dedicating their time in being committed to touching countless lives through consistent providing leadership, service, guidance and support to the municipalities of Kalilangan, Pangantucan, and Wao. Their continued dedication reflects a life of selfless service, inspiring communities to grow in faith, unity, and love for God.', bis: 'Gawas sa ilang kadasig sa pagdala sa kape gikan sa umahan ngadto sa tasa, susama usab ang ilang kadasig sa paggahin og panahon alang sa pagtukod og komunidad nga nagsentro kang Kristo. Sulod sa kapin napulo ka tuig, matinud-anon silang nag-alagad isip Chapter 5 coordinators sa Youth for Christ Pangantucan Chapter, nga naghatag og pagpangulo, pag-alagad, giya, ug suporta sa mga lungsod sa Kalilangan, Pangantucan, ug Wao. Ang ilang padayon nga dedikasyon nagpakita og kinabuhi sa walay hakog nga pag-alagad, nga nag-awhag sa mga komunidad nga motubo sa pagtuo, panaghiusa, ug gugma sa Dios.' },
    'cafe.finca-logo.label': { en: 'Finca de Garces Logo', bis: 'Logo sa Finca de Garces' },
    'cafe.finca-logo.description': { en: 'This was Finca de Garces\' old logo. Owners decided to renew their branding years later to bring a new face to Finca de Garces while preserving the farm\'s roots.', bis: 'Kini ang daan nga logo sa Finca de Garces. Gibag-o sa mga tag-iya ang ilang branding paglabay sa mga tuig aron mahatagan og bag-ong dagway ang Finca de Garces, apan gitipigan gihapon ang gamot sa umahan.' },
    'cafe.bar.label': { en: 'The Bar', bis: 'Ang Bar' },
    'cafe.bar.description': { en: 'The bar is where specialty coffee is meticulously crafted, served and discussed. Unlike traditional and commercial cafes, this is where the owners showcase the careful process of pouring a cup of specialty coffee while they engage with visitors.', bis: 'Ang bar mao ang dapit diin maampingong ginahimo, gisilbi, ug gihisgotan ang specialty coffee. Lahi sa naandan ug komersyal nga mga café, dinhi gipakita sa mga tag-iya ang maampingong proseso sa pagbubo sa usa ka tasa sa specialty coffee samtang nakigsulti sa mga bisita.' },
    'cafe.coffee-brewing.label': { en: 'Brew Coffee', bis: 'Paghimo og Kape' },
    'cafe.coffee-brewing.description': { en: '', bis: '' },
    'cafe.chill-section.label': { en: 'Chill Section', bis: 'Chill Section' },
    'cafe.chill-section.description': { en: 'The owners always emphasize creating connections. The chill section is where customers can play with games, cards and indulge in books to create conversation and a relaxing atmosphere whilst enjoying a cup of coffee.', bis: 'Kanunay gipasiugda sa mga tag-iya ang paghimo og koneksyon. Ang chill section mao ang dapit diin ang mga bisita makadula og mga dula ug baraha, ug makabasa og mga libro aron makamugna og panag-istoryahanay ug hayahay nga palibot samtang nagtagamtam sa usa ka tasa sa kape.' },
    'cafe.exit-to-exterior.label': { en: 'To Nursery', bis: 'Padulong sa Binhianan' },
    'cafe.exit-to-exterior.label.complete': { en: 'Go Outside', bis: 'Gawas sa Café' },
    'cafe.exit-to-exterior.description': { en: 'Click to step outside the cafe.', bis: 'I-klik aron mogawas sa café.' },
    'cafe.quiz.question': { en: 'What was the original purpose of establishing Alegre Café and Roastery?', bis: 'Unsa ang orihinal nga katuyoan nganung gitukod ang Alegre Café ug Roastery?' },
    'cafe.quiz.choice.0': { en: 'To become the largest coffee exporter not only in the region but throughout the Philippines', bis: 'Aron makatulod ug pinakadakung maka-eksport ug kape dili lamang sa rehiyon, apan usab tibuok Pilipinas' },
    'cafe.quiz.choice.1': { en: 'To create a place where people can gather, converse, and enjoy coffee grown from their own farm', bis: 'Aron makahimo og lugar diin ang mga tawo makatapok, mag-istoryahanay, ug motagamtam sa kapeng gipatubo sa ilang kaugalingong umahan' },
    'cafe.quiz.choice.2': { en: 'To sell imported specialty and rare varieties of coffee', bis: 'Aron mamaligya ug mga imported nga espesyal ug talagsaong klase sa kape' },
    'cafe.quiz.choice.3': { en: 'To make Bukidnon the coffee capital of the Philippines and promote tourism', bis: 'Aron mamahimong coffee capital ang probinsya sa Bukidnon ug mapalambo niini ang turismo' },
    'cafe.quiz.clue': { en: 'Think about why the family opened the café — it wasn\'t about scale or selling someone else\'s beans.', bis: 'Hunahunaa kung ngano nga giablihan sa pamilya ang café — dili kini mahitungod sa gidak-on o sa pagbaligya sa liso sa uban.' },
    'cafe.quiz.feedback': { en: 'Correct! Alegre Café & Roastery was created as a place where people can connect through coffee while learning the story behind every cup.', bis: 'Sakto! Ang Alegre Café & Roastery gimugna isip lugar diin ang mga tawo magkaduol pinaagi sa kape samtang nakat-on sa istorya sa likod sa matag tasa.' },
    'cafeExterior.enter-interior.label': { en: 'Enter Cafe', bis: 'Sulod sa Café' },
    'cafeExterior.enter-interior.description': { en: 'Click to go inside.', bis: 'I-klik aron mosulod.' },
    'cafeExterior.to-roastery.label': { en: 'Enter the Roastery', bis: 'Sulod sa Sanlaganan' },
    'cafeExterior.to-roastery.description': { en: 'Step inside and see where the coffee is roasted.', bis: 'Sulod ug tan-awa kung diin gisanlag ang kape.' },
    'cafeExterior.to-nursery.label': { en: 'Enter the Nursery', bis: 'Sulod sa Binhianan' },
    'cafeExterior.to-nursery.description': { en: 'Visit the coffee seedling nursery.', bis: 'Duawa ang binhianan sa mga tanom nga kape.' },
    'cafeExterior.walk-to-farm.label': { en: 'Walk to the Farm', bis: 'Baktas Padulong sa Umahan' },
    'cafeExterior.walk-to-farm.description': { en: 'Take the path from the cafe to the coffee farm.', bis: 'Agiha ang dalan gikan sa café padulong sa umahan sa kape.' },
    'nursery.back-to-exterior.label': { en: 'Walk to the Farm', bis: 'Baktas Padulong sa Umahan' },
    'nursery.back-to-exterior.description': { en: 'Take the path to the coffee farm.', bis: 'Agiha ang dalan padulong sa umahan sa kape.' },
    'nursery.seedlings.label': { en: 'Seedlings', bis: 'Mga Punla' },
    'nursery.seedlings.description': { en: 'This is where the coffee journey begins. Young plants are nurtured under careful shade and watering conditions before being transplanted to the farm.', bis: 'Dinhi magsugod ang panaw sa kape. Ang batan-ong mga tanom giatiman ubos sa hustong landong ug pagbisbis sa dili pa kini ibalhin ngadto sa umahan.' },
    'nursery.net-shading.label': { en: 'Net Shading', bis: 'Net Shading' },
    'nursery.net-shading.description': { en: 'Black net shading protects the seedlings from direct sun and helps regulate temperature.', bis: 'Ang itom nga net shading nagpanalipod sa mga punla gikan sa direktang init sa adlaw ug nagtabang sa pagkontrol sa temperatura.' },
    'nursery.quiz.question': { en: 'How many months do young coffee seedlings typically stay in polybags before being planted in the soil?', bis: 'Pila ka bulan kasagarang magpabilin sa polybags ang gagmay pa nga binhi sa kape ayha kini itanom sa yuta?' },
    'nursery.quiz.choice.0': { en: '1–2 months', bis: '1–2 ka bulan' },
    'nursery.quiz.choice.1': { en: '3–4 months', bis: '3–4 ka bulan' },
    'nursery.quiz.choice.2': { en: '6–7 months', bis: '6–7 ka bulan' },
    'nursery.quiz.choice.3': { en: '2 years', bis: '2 ka tuig' },
    'nursery.quiz.clue': { en: 'Longer than a few months — roots need real time to establish before transplanting.', bis: 'Mas dugay pa kaysa pipila ka bulan — ang gamot nagkinahanglan og tinuod nga panahon aron molig-on sa dili pa ibalhin.' },
    'nursery.quiz.feedback': { en: 'Correct! Seedlings remain in polybags for about six to seven months, allowing them to develop strong roots before being transplanted.', bis: 'Sakto! Ang mga punla magpabilin sa polybags sulod sa unom ngadto sa pito ka bulan, aron molig-on ang ilang gamot sa dili pa kini ibalhin.' },
    'roastery.back-to-exterior.label': { en: 'Exit to Cafe', bis: 'Balik sa Café' },
    'roastery.back-to-exterior.description': { en: 'Return to the cafe garden.', bis: 'Balik sa hardin sa café.' },
    'roastery.roasting-machine.label': { en: 'Roasting Machine', bis: 'Makina sa Pagsanlag' },
    'roastery.roasting-machine.description': { en: 'The roaster applies controlled heat to green coffee beans, moving them through drying, first crack, and development — the stages that build the sugars, acids, and oils responsible for flavour and aroma. Roast time and temperature are adjusted to draw out each bean\'s best character before cooling and packaging.', bis: 'Ang roaster naghatag og kontrolado nga kainit sa lunhaw nga liso sa kape, nga giagi kini sa pagpauga, first crack, ug development — ang mga hugna nga naghimo sa mga asukar, asido, ug lana nga maoy hinungdan sa lami ug kahumot. Ang gidugayon ug temperatura sa pagsanlag gi-adjust aron mogawas ang labing maayong kinaiya sa matag liso sa dili pa kini pabugnawon ug iputos.' },
    'roastery.roasting-beans-transition.label': { en: 'Roasting Beans', bis: 'Pagsanlag sa Liso' },
    'roastery.roasting-beans-transition.description': { en: 'Watch the beans roast', bis: 'Tan-awa ang pagsanlag sa mga liso' },
    'roastery.green-bean-packs.label': { en: 'Green Bean Packs', bis: 'Mga Pakete sa Lunhaw nga Liso' },
    'roastery.green-bean-packs.description': { en: 'Arabica grows at higher elevations and is known for a smoother, more complex, slightly sweet profile with milder acidity. Robusta is hardier, carries more caffeine, and brings a bolder, more bitter character — often used to add body and crema.', bis: 'Ang Arabica motubo sa mas hataas nga dapit ug nailhan sa mas hamis, mas komplikado, ug gamay nga tam-is nga lami uban sa mas hinay nga aslom. Ang Robusta mas kusgan, mas daghan og caffeine, ug naghatag og mas isog ug mas pait nga kinaiya — kasagarang gigamit aron madugangan ang katambok ug crema.' },
    'roastery.quiz.question': { en: 'What does the "first crack" mean during coffee roasting?', bis: 'Unsay gipasabot sa \'first crack\' samtang gisanlag ang mga liso sa kape?' },
    'roastery.quiz.choice.0': { en: 'This is when the flavor of the coffee beans can already be smelled and they are ready to be planted', bis: 'Masimhotan na dinhi ang lami nga liso sa kape ug andam na kini para itanom' },
    'roastery.quiz.choice.1': { en: 'It is a sign that the flavors and aromas of the coffee beans are beginning to develop', bis: 'Timailhan kini nga nagsugod na ug gawas ang lami ug kahumot sa mga liso sa kape' },
    'roastery.quiz.choice.2': { en: 'It is time to remove the coffee beans because it indicates that they are ready to be ground', bis: 'Panahon na para haonon ang mga liso sa kape kay timailhan kini nga andam na kini galingon' },
    'roastery.quiz.choice.3': { en: 'The beans are ready to be removed and rested to release the trapped air', bis: 'Andam na ang mga liso nga ihaon ug papahulayon aron makagawas ang hangin nga natanggong' },
    'roastery.quiz.clue': { en: 'First crack happens in the middle of roasting, not at the end — it\'s about flavor developing.', bis: 'Ang first crack mahitabo sa tunga sa pagsanlag, dili sa katapusan — mahitungod kini sa paglambo sa lami.' },
    'roastery.quiz.feedback': { en: 'Correct! The first crack signals an important stage where the beans expand and develop the flavors and aromas we associate with coffee.', bis: 'Sakto! Ang first crack timailhan sa importanteng hugna diin molapad ang mga liso ug molambo ang lami ug kahumot nga atong nailhan sa kape.' },
    'streetView.quiz.question': { en: 'Why is organic fertilizer added to the soil before planting coffee seedlings?', bis: 'Nganung butangan og organikong abono ang yuta ayha itanom ang binhi sa kape?' },
    'streetView.quiz.choice.0': { en: 'To improve the health and quality of the soil, which helps the seedlings grow', bis: 'Aron mahimong mas himsog ang yuta nga makatabang sa pagpatubo sa binhi' },
    'streetView.quiz.choice.1': { en: 'To make it easier to detect diseases in the seedlings and speed up coffee harvesting', bis: 'Aron mas sayon makita ang sakit sa binhi ug mas mapadali ang pag-ani sa kape' },
    'streetView.quiz.choice.2': { en: 'To make it easier to learn how to improve the taste of coffee and speed up the roasting process', bis: 'Aron mas dali makita ang pamaagi unsaon pagpalami sa kape ug mapaspas ang pagsanlag niini' },
    'streetView.quiz.choice.3': { en: 'To make the seedlings grow faster and produce healthy brown coffee cherries', bis: 'Aron mas dali ang pagpatubo niini ug makita ang himsog nga brown nga bunga sa kape' },
    'streetView.quiz.clue': { en: 'Think about what the fertilizer touches first — it goes into the hole, before the tree ever grows.', bis: 'Hunahunaa kung unsa ang unang mahikapan sa abono — mosulod kini sa lungag, sa dili pa motubo ang punoan.' },
    'streetView.quiz.feedback': { en: 'Correct! Healthy coffee trees begin with healthy soil. Preparing the planting hole with organic fertilizer gives young trees the best possible start.', bis: 'Sakto! Ang himsog nga punoan sa kape magsugod sa himsog nga yuta. Ang pag-andam sa lungag pinaagi sa organikong abono naghatag sa batan-ong punoan sa labing maayong sinugdanan.' },
    'quiz.harvesting.question': { en: 'Which coffee cherries are selected during harvesting?', bis: 'Unsa lang nga bunga sa kape ang pilion panahon sa pagpamupo (pag-ani)?' },
    'quiz.harvesting.choice.0': { en: 'Large but still green cherries', bis: 'Mga berde pa ug nidaku na nga bunga' },
    'quiz.harvesting.choice.1': { en: 'Unripe and fallen cherries', bis: 'Ang hilaw ug mga nanga-hagbong nga bunga' },
    'quiz.harvesting.choice.2': { en: 'Bright red, fully ripe cherries', bis: 'Hayag og pula, hinog kaayo nga mga bunga' },
    'quiz.harvesting.choice.3': { en: 'All the cherries present on the coffee plant during harvest', bis: 'Tanan bunga sa punoan nga anaa sa panahon sa pagpamupo' },
    'quiz.harvesting.clue': { en: 'Look closely at the colour of the cherries the pickers reach for.', bis: 'Tan-awa pag-ayo ang kolor sa mga bunga nga gikuha sa mga mamumupo.' },
    'quiz.harvesting.feedback': { en: 'Correct! Only fully ripe cherries are hand-picked to ensure the highest coffee quality.', bis: 'Sakto! Ang hinog na kaayo nga mga bunga lamang ang gipupo pinaagi sa kamot aron masiguro ang labing taas nga kalidad sa kape.' },
    'quiz.backToTheCafe.question': { en: 'How many grams of specialty coffee beans are needed for brewing?', bis: 'Pila ka gramo sa specialty coffee beans ang kinahanglan timbangon sa pag-brew niini?' },
    'quiz.backToTheCafe.choice.0': { en: '18 grams', bis: '18 gramo' },
    'quiz.backToTheCafe.choice.1': { en: '40 grams', bis: '40 gramo' },
    'quiz.backToTheCafe.choice.2': { en: '15 grams', bis: '15 gramo' },
    'quiz.backToTheCafe.choice.3': { en: '10 grams', bis: '10 gramo' },
    'quiz.backToTheCafe.clue': { en: 'Think of the recipe from the brewing demo — it\'s a smaller dose than a full pot.', bis: 'Hunahunaa ang resipe gikan sa brewing demo — mas gamay kini kaysa sa tibuok kaldero.' },
    'quiz.backToTheCafe.feedback': { en: 'Correct! 15g of beans to 225ml of water is the ratio the café brews at.', bis: 'Sakto! 15g nga liso sa 225ml nga tubig — mao kini ang sukod nga gigamit sa kapehan.' },
    'quiz.finalChallenge.question': { en: 'How many seconds should the coffee be allowed to rest during blooming?', bis: 'Pila ka segundo kinahanglan papahulayon alang sa blooming?' },
    'quiz.finalChallenge.choice.0': { en: '30 seconds', bis: '30 segundos' },
    'quiz.finalChallenge.choice.1': { en: '45 seconds', bis: '45 segundos' },
    'quiz.finalChallenge.choice.2': { en: '37 seconds', bis: '37 segundos' },
    'quiz.finalChallenge.choice.3': { en: '90 seconds', bis: '90 segundos' },
    'quiz.finalChallenge.clue': { en: 'The bloom is short — under a minute, and it matches the seconds in the brewing steps.', bis: 'Mubo ra ang blooming — dili moabot og usa ka minuto, ug mohaom kini sa mga segundo sa paghimo og kape.' },
    'quiz.finalChallenge.feedback': { en: 'Correct \u2014 45 seconds for the bloom. Congratulations! You\'ve completed the Coffee Journey. Thank you for exploring the story of Alegre Café & Roastery and discovering how every cup is shaped by the land, the people, and generations of dedication. We hope you\'ll carry this story with you every time you enjoy a cup of coffee. ☕', bis: 'Sakto \u2014 45 segundos para sa blooming. Congratulations! Nahuman na nimo ang Panaw sa Kape. Salamat sa pagsuhid sa istorya sa Alegre Café & Roastery ug sa pagkat-on kung giunsa paghulma sa yuta, sa mga tawo, ug sa mga henerasyon sa dedikasyon ang matag tasa. Hinaot nga dad-on ninyo kini nga istorya sa matag higayon nga motagamtam kamo og kape. ☕' },
    'ui.nursery.toFarm': { en: 'To Farm', bis: 'Padulong sa Umahan' },
    'ui.video.continue': { en: 'Continue', bis: 'Padayon' },
    'ui.video.roasteryPrompt': { en: 'Select Continue to visit the roastery', bis: 'I-klik ang Padayon aron moadto sa sanlaganan' },
    'ui.tutorial.look': { en: 'Drag to look around', bis: 'I-drag aron molingi-lingi' },
    'ui.tutorial.walk': { en: 'Use W A S D to walk', bis: 'Gamita ang W A S D aron molakaw' },
    'ui.tutorial.orb':  { en: 'Click a blue marker to learn more', bis: 'I-klik ang asul nga marka aron makahibalo pa' },
    'ui.tutorial.gate': { en: 'Click the golden button to continue', bis: 'I-klik ang bulawanon nga button aron mopadayon' },
    'ui.disc.toHarvest': { en: 'To Harvest', bis: 'Padulong sa Ting-ani' },
    'ui.quiz.encouragement': { en: 'It\'s okay to get it wrong — just give it your best guess!', bis: 'Okay ra kung masayop ka — sulayi lang ang imong labing maayong tubag!' },
    'ui.quiz.correct': { en: 'Correct!', bis: 'Sakto!' },
    'ui.clue.ahead': { en: 'It\'s right in front of you', bis: 'Naa ra sa imong atubangan' },
    'ui.clue.right': { en: 'Look to your right', bis: 'Tan-aw sa imong tuo' },
    'ui.clue.left': { en: 'Look to your left', bis: 'Tan-aw sa imong wala' },
    'ui.clue.behind': { en: 'Turn around — it\'s behind you', bis: 'Lingi — naa sa imong likod' },

    // Loading-screen journey progress labels, in narrative order.
    // These were blank in bis, which t() silently falls back to English for. That was
    // invisible while they only appeared on the loading screen; the journey bar puts
    // them on screen for the whole journey, so they are filled in now.
    'ui.progress.cafeInterior': { en: 'Cafe', bis: 'Kapehan' },
    'ui.progress.nursery': { en: 'Nursery', bis: 'Binhianan' },
    'ui.progress.journeyToFarm': { en: 'To the Farm', bis: 'Padulong sa Uma' },
    'ui.progress.farm': { en: 'Farm', bis: 'Uma' },
    'ui.progress.harvesting': { en: 'Harvest', bis: 'Ting-ani' },
    'ui.progress.roastery': { en: 'Roastery', bis: 'Sanlagan' },
    'ui.progress.backToCafe': { en: 'Back to the Cafe', bis: 'Balik sa Kapehan' },

    // Score and reward. Points come only from first-try correct answers on the six
    // scene quizzes; mini-quizzes never count. Winning is at most one wrong answer
    // across the whole run, and only on a player's first completed run.
    'ui.score.winTitle': { en: 'You did it \u2014 a coffee expert!', bis: 'Nahimo nimo — usa ka eksperto sa kape!' },
    'ui.score.winBody': { en: 'You answered almost every question right the first time. That earns you a Granja Alegre keychain \u2014 your choice of design.', bis: 'Hapit tanang pangutana imong natubag og sakto sa unang higayon. Tungod niini, makadawat ka og Granja Alegre keychain — ikaw ang mopili sa disenyo.' },
    'ui.score.loseTitle': { en: 'Journey complete', bis: 'Nahuman ang panaw' },
    'ui.score.loseBody': { en: 'You made it from seed to cup \u2014 thank you for coming along! The keychain goes to near-perfect runs, with at most one wrong answer, and this time it was just out of reach.', bis: 'Naabot nimo gikan sa liso ngadto sa tasa — salamat sa imong pag-uban! Ang keychain para sa halos hingpit nga dula, usa ra ka sayop nga tubag ang gitugot, ug niining higayona wala gyud maabot.' },
    'ui.score.replayTitle': { en: 'Journey complete', bis: 'Nahuman ang panaw' },
    'ui.score.replayBody': { en: 'Thanks for coming back. The keychain is for a first run only, so this one is just for the love of coffee.', bis: 'Salamat sa imong pagbalik. Ang keychain para lamang sa unang dula, busa kini para na lang sa gugma sa kape.' },
    'ui.score.claimContact': { en: 'Message Andrew Ulysess E. Bautro to claim your prize.', bis: 'I-message si Andrew Ulysess E. Bautro aron makuha ang imong premyo.' },
    'ui.score.claimProof': { en: 'Screenshot this screen as proof.', bis: 'I-screenshot kini nga screen isip pamatuod.' },
    'ui.score.formButton': { en: 'Choose your keychain', bis: 'Pilia ang imong keychain' },
    'ui.score.continue': { en: 'Continue', bis: 'Padayon' },

    // Scene summaries. Shown at a scene's exit only when the player seeked forward in
    // it -- a recap of what the narration said, for someone who chose not to hear it.
    // bis is a placeholder copy of the English pending translation.
    'ui.summary.title': { en: 'What you skipped', bis: 'Ang imong gilaktawan' },
    'ui.summary.continue': { en: 'Continue', bis: 'Padayon' },
    'ui.summary.brandStoryIntro': { en: 'Our coffee comes from Pangantucan, Bukidnon, at the foot of Mt. Kalatungan, where volcanic soil and cool mountain air grow exceptional coffee.', bis: 'Ang among kape gikan sa Pangantucan, Bukidnon, sa tiilan sa Bukid Kalatungan, diin ang bulkanikong yuta ug ang bugnaw nga hangin sa bukid nagpatubo og talagsaong kape.' },
    'ui.summary.cafeInterior': { en: 'The Garces family opened Alegre Cafe in 2023 as a place to gather, share stories, and enjoy coffee from their own farm. Owner Melissa believes great coffee needs passionate people, not a big farm.', bis: 'Giablihan sa pamilyang Garces ang Alegre Café niadtong 2023 isip tigomanan, bayloanan og mga istorya, ug lugar sa pagtagamtam sa kape gikan sa ilang kaugalingong uma. Nagtuo si Melissa, ang tag-iya, nga ang maayong kape nagkinahanglan og madasigong mga tawo, dili dakong uma.' },
    'ui.summary.nursery': { en: 'Seeds sprout in seedbeds, then grow in polybags for 6\u20137 months. Once planted, trees take 3\u20134 years to fruit. White flowers become green cherries that ripen red over 7\u20139 months.', bis: 'Ang mga liso motubo sa seedbed, dayon magpabilin sulod sa 6\u20137 ka bulan sa dili pa itanom. Human itanom, ang mga punoan magkinahanglan og 3\u20134 ka tuig aron mamunga. Ang puti nga mga bulak mahimong berde nga cherry nga mohinog ug mapula sulod sa 7\u20139 ka bulan.' },
    'ui.summary.journeyToFarm': { en: 'The farm is about a kilometre from the cafe, and half the way is on foot.', bis: 'Ang uma mga usa ka kilometro gikan sa kapehan, ug ang katunga sa agianan baktason.' },
    'ui.summary.farm': { en: 'Each planting hole gets organic fertilizer, and seedlings go in during the wet season. Trees are monitored to catch pests and disease early. Farmer Lin shares the hard work behind every harvest.', bis: 'Ang matag lungag nga tamnanan butangan og organikong abono, ug ang mga semilya itanom panahon sa ting-ulan. Gibantayan ang mga punoan aron masayran dayon ang peste ug sakit. Gipaambit ni Farmer Lin ang kakugi luyo sa matag ani.' },
    'ui.summary.harvesting': { en: 'Only ripe red cherries are hand-picked. They\u2019re washed, sorted, and floated \u2014 the heavy ones that sink are kept \u2014 then dried to 10\u201312% moisture.', bis: 'Ang hinog ug pula nga cherry lamang ang pupoon sa kamot. Hugasan kini, pilion, ug palutawon — ang bug-at nga molunod maoy tipigan — dayon ipauga hangtod 10–12% nga umog.' },
    'ui.summary.roasting': { en: 'Beans roast under controlled heat, airflow, and time. The \u201cfirst crack\u201d means flavour is developing. Roasted beans rest 24 hours before packing.', bis: 'Ang mga liso sanlagon sa kontrolado nga kainit, hangin, ug oras. Ang “first crack” nagpasabot nga nagsugod na ang lami. Pahulayon ang sinanlag nga liso sulod sa 24 ka oras sa dili pa iputos.' },
    'ui.summary.backToCafe': { en: 'Grind 15g medium-coarse, rinse the filter, bloom with 45ml for 45 seconds, then pour to 225ml. Every cup carries the care of the people behind it.', bis: 'Galingon ang 15g nga medium-coarse, banlawi ang filter, i-bloom gamit ang 45ml sulod sa 45 segundos, dayon ibubo hangtod 225ml. Ang matag tasa nagdala sa pag-atiman sa mga tawo luyo niini.' },

    // Tutorial: a standing hint, not a step -- it never blocks and never needs a press.
    // Leads with the on-screen buttons because they are the discoverable control; the
    // arrow keys are named after them as the shortcut, not as the primary way in.
    'ui.tutorial.seekHint': { en: 'Use the ⏪ ⏩ buttons to skip 10s (or the \u2190 \u2192 keys)', bis: 'Gamita ang ⏪ ⏩ nga buton aron molaktaw 10s (o ang \u2190 \u2192 nga yawi)' },

    // Brand-story gate: aria-labels only. The gate is an icon, so the label is the
    // only thing that says which of the two things it does.
    'ui.brandStory.gatePlay': { en: 'Play the next part of the story', bis: 'I-play ang sunod nga bahin sa istorya' },
    'ui.brandStory.gateEnter': { en: 'Enter the café', bis: 'Sulod sa kapehan' },

    // Seek buttons: aria-labels only -- the visible face is the icon plus −10s / +10s.
    'ui.seek.back': { en: 'Go back 10 seconds', bis: 'Balik 10 segundos' },
    'ui.seek.forward': { en: 'Skip ahead 10 seconds', bis: 'Laktaw 10 segundos' },

    // Coffee tree: one line per stage, including the intermediate stages the nursery
    // and farm pop-ups pass through on their way to the stage the hook ends at.
    'ui.tree.seed': { en: 'It starts with a single seed.', bis: 'Nagsugod kini sa usa ka liso.' },
    'ui.tree.sprout': { en: 'A shoot breaks through the soil.', bis: 'Miturok na ang liso.' },
    'ui.tree.polybagSeedling': { en: 'Your seed has sprouted into a seedling.', bis: 'Nahimo nang semilya ang imong liso.' },
    'ui.tree.youngTree': { en: 'Planted out, your tree takes root.', bis: 'Natanom na, ug nagagamot ang imong punoan.' },
    'ui.tree.flowering': { en: 'Your tree is grown, and in flower.', bis: 'Ang imong punoan dako na ug namulak.' },
    'ui.tree.ripeCherries': { en: 'The cherries are ripe and ready to pick.', bis: 'Hinog na ang mga cherry ug andam nang panguhaon.' },
    'ui.tree.roastedBeans': { en: 'Roasted, and ready to brew.', bis: 'Sinanlag na, ug andam nang timplahon.' },
    'ui.tree.cup': { en: 'From seed to cup \u2014 your journey is complete.', bis: 'Gikan sa liso ngadto sa tasa \u2014 kompleto na ang imong panaw.' },

    // Journey bar (the collapsed pill and its expanded panel)
    'ui.journey.title': { en: 'Your Journey', bis: 'Imong Panaw' },
    'ui.journey.expand': { en: 'Show your journey', bis: 'Ipakita ang imong panaw' },
    'ui.journey.collapse': { en: 'Hide your journey', bis: 'Itago ang imong panaw' },

    // Farm close-up hunt hints. Shown while the golden disc at farm1-4 is unfound;
    // keyed by the player's current position. Display text, unrelated to arrow labels.
    'ui.farm.hint.farm1-1': { en: 'Keep heading forward.', bis: 'Padayon lang sa pag-adto sa unahan.' },
    'ui.farm.hint.farm1-2': { en: 'Explore the area ahead.', bis: 'Suroya ang dapit sa unahan.' },
    'ui.farm.hint.farm1-3': { en: 'So close. Moving forward should help.', bis: 'Duol na kaayo. Padayon lang sa unahan.' },
    // The close-up orb now sits beside the forward disc at eye level, not below the
    // player, so the old "look down" wording no longer describes where it is.
    'ui.farm.hint.farm1-4': { en: 'You\'re really close — the golden button is just left of the disc.', bis: 'Duol na kaayo ka — ang bulawanon nga button naa sa wala sa disc.' },
    'ui.farm.hint.farm1-5': { en: 'You\'ve gone a bit far. Move back a little.', bis: 'Nalapas na ka og gamay. Balik og diyutay.' },
    'ui.farm.hint.default': { en: 'Look around for the golden button.', bis: 'Pangitaa ang bulawanon nga button sa imong palibot.' },
    // Fires when the player tries to leave farm1-4 before opening the close-up, so it
    // must point the same way as ui.farm.hint.farm1-4 above — not down, where the orb
    // used to sit.
    'ui.farm.closeupFirst': { en: 'Click the golden button left of the disc first.', bis: 'I-klik una ang bulawanon nga button sa wala sa disc.' },

    // Gate-marker buttons (keyed by gate.ref in voData.js)
    'ui.gate.default': { en: 'Watch', bis: 'Tan-awa' },
    'ui.gate.mapZoom': { en: 'Continue', bis: 'Padayon' },
    'ui.gate.aerial': { en: 'Continue', bis: 'Padayon' },
    'ui.gate.farmerMontage': { en: 'Continue', bis: 'Padayon' },
    'ui.gate.ownerInterview': { en: 'Hear the story behind Granja Alegre', bis: 'Paminawa ang istorya sa luyo sa Granja Alegre' },
    'ui.gate.treePhoto': { en: 'See the trees', bis: 'Tan-awa ang mga punoan' },
    'ui.gate.roasterVideo': { en: 'Watch the roaster', bis: 'Tan-awa ang makina sa pagsanlag' },
    'ui.gate.brewingPOV': { en: 'See the brewing', bis: 'Tan-awa ang paghimo og kape' },
    'ui.gate.polybag': { en: 'Get a closer look at the seedlings', bis: 'Tan-awa pag-ayo ang mga punla' },
    'ui.gate.monitoring': { en: 'Learn about monitoring', bis: 'Hibaloi ang bahin sa pagbantay' },

    // Mini-quiz UI. NOTE: the correct answer is matched by string equality against
    // the option text, so a translated option must be paired with the same key.
    'ui.miniquiz.wrongPrefix': { en: 'Wrong.', bis: 'Sayop.' },
    'ui.miniquiz.flowers.question': { en: 'After the white coffee flowers fall, what grows next?', bis: 'Human sa paglagas sa mga puti nga bulak sa kape, unsa man ang sunod nga mutubo?' },
    'ui.miniquiz.flowers.a': { en: 'Small green coffee cherries', bis: 'Gagmay nga berde nga bunga sa kape' },
    'ui.miniquiz.flowers.b': { en: 'Small brown coffee cherries', bis: 'Gagmay nga brown nga bunga sa kape' },
    'ui.miniquiz.flowers.clue': { en: 'Think about color. Coffee cherries start out unripe — they only turn red much later.', bis: 'Hunahunaa ang kolor. Ang bunga sa kape dili pa hinog sa sinugdan — mamula lamang kini sa ulahi.' },
    'ui.miniquiz.monitoring.question': { en: 'Why do coffee plants need to be regularly monitored?', bis: 'Nganung permi bantayan ang mga punoan sa kape?' },
    'ui.miniquiz.monitoring.a': { en: 'To ensure that the coffee plants remain healthy and receive proper attention, which is important for their growth', bis: 'Aron masigurong himsog ug mahatagan ug tinuod nga atensyon ang punoan sa kape nga importante para sa pagpadaku niini' },
    'ui.miniquiz.monitoring.b': { en: 'To detect early if insects, pests, or diseases are attacking the coffee plants', bis: 'Aron sayo makita kung naay mga insekto, peste, o sakit nga muatake sa mga punoan' },
    'ui.miniquiz.monitoring.clue': { en: 'Monitoring doesn\'t fix a problem you can\'t see yet. Think about what a farmer is looking for.', bis: 'Ang pagbantay dili makaayo sa problema nga wala pa nimo makita. Hunahunaa kung unsa ang gipangita sa mag-uuma.' },
};
