import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const TUTOR_ID    = "6a250a3e55f31737681a82b6";
  const TUTOR_SLUG  = "arthur-chibondo";
  const AUTHOR_NAME = "Arthur Chibondo";
  const NOW         = new Date().toISOString();

  const posts = [
    {
      title: "Why Every Malawian Student Should Know the Story of John Chilembwe",
      slug: "john-chilembwe-story-every-malawian-student-should-know",
      excerpt: "John Chilembwe led one of Africa's earliest anti-colonial uprisings in 1915. Understanding his story is not just a history lesson — it is a lesson in courage, conviction, and the cost of justice.",
      content: "<h2>Who Was John Chilembwe?</h2><p>John Chilembwe was a Baptist minister and nationalist who led an armed uprising against British colonial rule in Nyasaland (modern-day Malawi) on 23 January 1915. To many, he was a visionary. To history, he is one of Africa's most important early freedom fighters.</p><h2>The Context: Life Under Colonial Rule</h2><p>By the early 1900s, African labourers worked under <em>thangata</em> — forced labour where rent was paid in unpaid work days. Men were conscripted to fight in World War I on behalf of a colonial power that gave them nothing in return.</p><p>Chilembwe had studied in the United States at the Virginia Theological Seminary. Returning to Malawi, he established Providence Industrial Mission in Chiradzulu — building schools and a church, practical acts of defiance against a system designed to keep Africans uneducated.</p><h2>The Uprising of 1915</h2><p>On the night of 23 January 1915, Chilembwe and his followers attacked the Magomero estate of William Jervis Livingstone — notorious for harsh treatment of African workers. Livingstone was killed. The rebellion was swiftly crushed and Chilembwe was shot dead on 3 February 1915.</p><h2>Why It Matters for Your MSCE Exams</h2><ul><li>The <strong>causes</strong>: thangata, WWI conscription, religious and educational frustration</li><li>The <strong>events</strong>: the attack on Magomero, Chilembwe's death</li><li>The <strong>significance</strong>: one of the first organised African resistances to colonialism in the region</li><li>The <strong>legacy</strong>: Chilembwe's face is on Malawian currency; 15 January is a national holiday</li></ul><h2>My Reflection</h2><p>What I find most powerful is the <em>letter</em> Chilembwe wrote to the Nyasaland Times before the uprising. He said: <em>\"Let us strike a blow and die.\"</em> He knew he would not survive. He acted anyway. Learn this story deeply — not just for your exams, but for your own understanding of where Malawi comes from.</p>",
      category: "History",
      tags: ["John Chilembwe","Malawi History","Colonial History","MSCE History","Central African History"],
      linked_subject_id: "6a241135c167bd3dd3c11f4b",
      linked_subject_name: "MSCE History | Central African History",
      meta_title: "John Chilembwe: The Story Every Malawian Student Must Know | ACA",
      meta_description: "Arthur Chibondo breaks down the John Chilembwe uprising of 1915 — causes, events, and why it matters for your MSCE History exam.",
      keywords: "John Chilembwe, Malawi history, colonial history, MSCE History, Chilembwe rising 1915",
      is_featured: true,
    },
    {
      title: "The Cold War Explained: How Two Superpowers Shaped the World You Live In",
      slug: "cold-war-explained-how-superpowers-shaped-the-world",
      excerpt: "The Cold War was not fought with guns between America and Russia — it was fought with spies, satellites, proxy wars, and propaganda. Here is a clear guide to what happened and why it still matters today.",
      content: "<h2>What Was the Cold War?</h2><p>The Cold War (1947–1991) was a period of intense geopolitical tension between the United States and the Soviet Union. It was called \"cold\" because the two sides never directly fought each other in open warfare.</p><h2>Two Ideologies, One Planet</h2><ul><li><strong>USA</strong>: Capitalism — private ownership, free markets, democratic elections</li><li><strong>USSR</strong>: Communism — state ownership, planned economy, one-party rule</li></ul><p>Each side believed its system was superior and worked to spread it across the globe.</p><h2>Key Events You Must Know</h2><p><strong>The Berlin Blockade (1948–49):</strong> The USSR blocked all road access to West Berlin. The USA responded with the Berlin Airlift — flying supplies in for 11 months.</p><p><strong>The Korean War (1950–53):</strong> Communist North Korea invaded South Korea. The USA and UN intervened. It ended in a stalemate — the 38th parallel border remains to this day.</p><p><strong>The Cuban Missile Crisis (1962):</strong> The USSR placed nuclear missiles in Cuba, 90 miles from Florida. For 13 days, the world held its breath. It ended when the USSR removed the missiles.</p><p><strong>The Fall of the Berlin Wall (1989):</strong> The wall dividing East and West Berlin fell on 9 November 1989. Two years later, the USSR collapsed.</p><h2>MSCE Exam Tip</h2><p>Examiners love asking you to explain causes and assess consequences. Always structure your answer: cause → event → consequence. Show you understand the ideological dimension — it separates average answers from excellent ones.</p>",
      category: "History",
      tags: ["Cold War","World History","MSCE History","USA vs USSR","Nuclear Arms Race"],
      linked_subject_id: "6a241150b71bae491353227d",
      linked_subject_name: "MSCE History | World History",
      meta_title: "The Cold War Explained for MSCE Students | ACA Blog",
      meta_description: "Mr. Arthur Chibondo explains the Cold War clearly — key events, ideological clash, and how to answer MSCE World History exam questions.",
      keywords: "Cold War, MSCE History, World History, USA USSR, Berlin Wall, Cuban Missile Crisis",
      is_featured: true,
    },
    {
      title: "How to Write a Brilliant MSCE History Essay: Structure, Evidence, and Language",
      slug: "how-to-write-msce-history-essay-structure-evidence-language",
      excerpt: "Most students lose marks in History not because they don't know the facts, but because they don't know how to present them. This guide gives you the exact essay structure examiners are looking for.",
      content: "<h2>Why Essay Structure Matters More Than You Think</h2><p>In MSCE History, you can know every date and every name — and still score poorly if your essay is disorganised. Examiners are marking you on how well you argue, not just what you know.</p><h2>The Three-Part Essay Structure</h2><h3>1. Introduction (2–3 sentences)</h3><p>State your argument directly. Do not begin with \"In this essay I will discuss...\" Instead, say: <em>\"The Chilembwe Rising of 1915 was primarily caused by economic exploitation, particularly the thangata system, rather than purely political or religious grievances.\"</em></p><h3>2. Body Paragraphs (3–4 paragraphs)</h3><p>Each paragraph should:</p><ul><li>Begin with a <strong>topic sentence</strong> that states one argument</li><li>Provide <strong>evidence</strong> — specific facts, dates, names</li><li>End with a <strong>link sentence</strong> that connects back to the question</li></ul><h3>3. Conclusion (2–3 sentences)</h3><p>Summarise your main argument. Do not introduce new points. A strong conclusion answers the question directly and shows you have a view.</p><h2>Language Tips</h2><p>Use precise historical language: <em>contributed to, led to, resulted in, was a consequence of, was a significant factor because...</em> These phrases show the examiner you understand cause and effect — the foundation of historical thinking.</p><h2>Practice Question</h2><p><em>\"Assess the main causes of the Chilembwe Rising of 1915.\"</em> Try writing this essay using the structure above. Post it in the forum — I will give you feedback personally.</p>",
      category: "Study Tips",
      tags: ["MSCE History","Essay Writing","Exam Technique","Study Tips","History"],
      linked_subject_id: "6a241135c167bd3dd3c11f4b",
      linked_subject_name: "MSCE History | Central African History",
      meta_title: "How to Write a Brilliant MSCE History Essay | ACA Blog",
      meta_description: "Mr. Arthur Chibondo shares the exact essay structure, language tips, and common mistakes to avoid in your MSCE History paper.",
      keywords: "MSCE History essay, history essay structure, exam technique, MSCE study tips",
      is_featured: false,
    },
    {
      title: "Acids, Bases and Salts: The Chemistry You Use Every Day Without Knowing It",
      slug: "acids-bases-salts-chemistry-you-use-every-day",
      excerpt: "You use acids and bases every single day — in your food, your soap, your stomach. Understanding the chemistry behind them is not just for passing MSCE. It is for understanding the world around you.",
      content: "<h2>Everything Is Chemistry</h2><p>The lemon in your tea is an acid. The soap you used this morning is a base. The antacid tablet you take for stomach pain contains a salt. Chemistry happens in your kitchen, your bathroom, and inside your own body every second of the day.</p><h2>What Is an Acid?</h2><p>An acid releases hydrogen ions (H⁺) when dissolved in water. Acids have a pH below 7.</p><ul><li><strong>Hydrochloric acid (HCl)</strong> — found in your stomach, helps digest food</li><li><strong>Sulphuric acid (H₂SO₄)</strong> — used in car batteries</li><li><strong>Ethanoic acid (CH₃COOH)</strong> — the acid in vinegar</li><li><strong>Citric acid</strong> — found in lemons and oranges</li></ul><h2>What Is a Base?</h2><p>A base accepts hydrogen ions (H⁺). When it dissolves in water, it is called an <strong>alkali</strong>. Bases have a pH above 7.</p><ul><li><strong>Sodium hydroxide (NaOH)</strong> — used in soap making</li><li><strong>Calcium hydroxide (Ca(OH)₂)</strong> — lime, used in agriculture to reduce soil acidity</li><li><strong>Ammonia (NH₃)</strong> — used in cleaning products</li></ul><h2>Neutralisation and Salts</h2><p>When an acid reacts with a base, they neutralise each other to produce a salt and water:</p><p><em>Acid + Base → Salt + Water</em></p><p>Example: HCl + NaOH → NaCl + H₂O — hydrochloric acid and sodium hydroxide produce table salt and water. Yes, table salt is the product of an acid-base reaction.</p><h2>The pH Scale</h2><p>The pH scale runs from 0 to 14. pH 7 is neutral. Below 7 is acidic. Above 7 is alkaline. In your MSCE exam, you must use universal indicator or a pH probe to determine whether a solution is acidic, neutral or alkaline.</p>",
      category: "Chemistry",
      tags: ["Acids and Bases","MSCE Chemistry","pH Scale","Salts","Neutralisation"],
      linked_subject_id: "6a241418d4b8bab0fb70a253",
      linked_subject_name: "MSCE Chemistry Book 3",
      meta_title: "Acids, Bases and Salts Explained for MSCE Chemistry | ACA Blog",
      meta_description: "Mr. Arthur Chibondo explains acids, bases and salts with real-world examples, equations, and exam tips for MSCE Chemistry students.",
      keywords: "acids bases salts, MSCE Chemistry, pH scale, neutralisation, chemistry Malawi",
      is_featured: false,
    },
    {
      title: "The Periodic Table Is Not Your Enemy: How to Read It Confidently",
      slug: "periodic-table-how-to-read-it-confidently",
      excerpt: "Most students look at the Periodic Table and feel overwhelmed. But once you understand its logic, it becomes one of the most powerful tools in Chemistry — and you get to use it in the exam.",
      content: "<h2>The Periodic Table Tells a Story</h2><p>The Periodic Table is arranged with precise logic — and once you understand that logic, reading it becomes intuitive rather than intimidating.</p><h2>How It Is Organised</h2><p>Elements are arranged by increasing <strong>atomic number</strong> (the number of protons in the nucleus):</p><ul><li><strong>Periods (rows)</strong> — Elements in the same period have the same number of electron shells</li><li><strong>Groups (columns)</strong> — Elements in the same group have the same number of outer electrons, meaning they have <strong>similar chemical properties</strong></li></ul><h2>The Most Important Groups to Know</h2><p><strong>Group 1 — The Alkali Metals</strong> (Li, Na, K): Very reactive. They react vigorously with water to produce hydrogen gas and an alkali solution. The further down the group, the more reactive.</p><p><strong>Group 7 — The Halogens</strong> (F, Cl, Br, I): Very reactive non-metals that all form -1 ions. The further <em>up</em> the group, the more reactive — opposite to metals.</p><p><strong>Group 0 — The Noble Gases</strong> (He, Ne, Ar): Completely unreactive. Their outer shells are full, so they have no need to gain or lose electrons.</p><h2>Reading an Element's Box</h2><ol><li><strong>Atomic number</strong> (top) — number of protons = number of electrons</li><li><strong>Symbol</strong> (middle) — one or two letters</li><li><strong>Relative atomic mass</strong> (bottom) — roughly protons + neutrons</li></ol><p>From the atomic number alone, you can work out protons, electrons, and with the mass number, the neutrons. That is powerful information from one small number.</p><h2>Exam Tip</h2><p>In MSCE Chemistry, you are given the Periodic Table in the exam. Do not memorise every element — learn to <em>read</em> the table. Know the key groups, understand the trends (reactivity, atomic radius), and you will answer questions you have never seen before.</p>",
      category: "Chemistry",
      tags: ["Periodic Table","MSCE Chemistry","Atomic Structure","Chemical Properties","Chemistry"],
      linked_subject_id: "6a241418d4b8bab0fb70a253",
      linked_subject_name: "MSCE Chemistry Book 3",
      meta_title: "How to Read the Periodic Table for MSCE Chemistry | ACA Blog",
      meta_description: "Mr. Arthur Chibondo explains the Periodic Table clearly — groups, periods, and how to use it confidently in your MSCE Chemistry exam.",
      keywords: "periodic table, MSCE Chemistry, atomic number, groups periods, chemistry Malawi",
      is_featured: false,
    },
  ];

  const results = [];
  for (const post of posts) {
    try {
      const record = await base44.asServiceRole.entities.BlogPost.create({
        ...post,
        tutor_profile_id: TUTOR_ID,
        tutor_slug: TUTOR_SLUG,
        author_name: AUTHOR_NAME,
        status: "published",
        published_at: NOW,
        view_count: 0,
      });
      results.push({ ok: true, id: record.id, title: post.title });
    } catch (e) {
      results.push({ ok: false, title: post.title, error: String(e) });
    }
  }

  return Response.json({ results });
});
