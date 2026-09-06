import React, { useState } from 'react';
import { 
  Sparkles, Leaf, Activity, CheckCircle2, AlertTriangle, Clock, 
  User, FileText, Shield, HeartPulse, Printer, Search, 
  ChevronRight, ChevronDown, Check, RefreshCw, ArrowLeft, 
  Compass, Eye, Layers, Flame, Wind, Droplets, Stethoscope,
  X, Download, Calendar, ExternalLink
} from 'lucide-react';

// =============================================================================
// REALISTIC MOCK PATIENTS & AYUSH CLINICAL REGISTRY DATA
// =============================================================================

const MOCK_AYUSH_PATIENTS = [
  {
    id: "CARE-928104",
    name: "Rajesh Kumar Sharma",
    age: 52,
    gender: "Male",
    bloodGroup: "B+",
    phone: "+91 98765 43210",
    occupation: "Senior Accountant",
    abhaId: "91-4829-1048-2918",
    lastVisit: "2026-09-04",
    assessedBy: "Dr. Arvind Vaidya, BAMS, MD (Ayu)",
    reviewStatus: "Clinician Verified",
    assessmentCompleteness: 94,
    
    // Core AYUSH Diagnostic Profile
    prakriti: {
      type: "Pitta-Vata (Dvandvaja)",
      primaryDosha: "Pitta",
      secondaryDosha: "Vata",
      vataScore: 42,
      pittaScore: 40,
      kaphaScore: 18,
      physicalCharacteristics: "Medium build, slightly dry skin with warm undertone, moderate muscle mass, quick movements.",
      mentalTemperament: "Alert, articulate, goal-oriented, prone to irritability and mild anxiety under work pressure."
    },
    vikriti: {
      currentDosha: "Vata Vriddhi with Pitta Anubandha",
      vataScore: 56,
      pittaScore: 32,
      kaphaScore: 12,
      severity: "Moderate Aggravation",
      aggravatingFactors: "Irregular meals, sedentary sitting for 9 hours daily, dry autumn wind exposure, late-night auditing."
    },
    agni: {
      category: "Vishama Agni (Variable Digestive Fire)",
      description: "Fluctuating digestive capacity. Alternates between intense hunger and early satiety with post-prandial distension.",
      jaranaShakti: "Madhyama (Moderate digestion speed, 4-5 hours for light meals)",
      abhyavaharanaShakti: "Madhyama (Moderate food intake capability)"
    },
    koshtha: {
      category: "Krura Koshtha (Hard/Dry Bowel Motility)",
      description: "Tendency towards sluggish bowel movements and dry, hard scybalous stools unless warm liquid or ghee is consumed.",
      malotsargaFrequency: "Once daily, incomplete evacuation sensation, Apana Vayu upward pressure."
    },
    aharaVihara: {
      dietaryHabits: "Predominance of Katu (pungent) and Lavana (salty) tastes; frequent dry snacks, cold water with meals.",
      viruddhaAhara: "Occasional intake of fruit smoothies with milk; reheated spicy gravies.",
      satmya: "Habituated to wheat, moong dal, and cooked vegetables; intolerance to curd at dinner.",
      dinacharya: "Wake up at 6:30 AM (after sunrise), lack of Abhyanga (oil massage), irregular lunch timings.",
      nidra: "Khandita Nidra (interrupted sleep), difficulty falling asleep before midnight, waking up at 4:30 AM with racing thoughts."
    },
    nidana: {
      primaryEtiology: "Vata-vardhaka Ahara (dry, light, cold food), Vegadharana (suppression of natural urges while working), and Manasika Chinta (mental stress).",
      secondaryTriggers: "Excessive air conditioning exposure, missed breakfast, high screen exposure."
    },
    samprapti: {
      rogaName: "Sandhigata Vata (Osteoarticular Degeneration) with Amlapitta (Hyperchlorhydria)",
      dosha: "Vata (Vyana & Apana Vayu) and Pitta (Pachaka Pitta)",
      dushya: "Asthi (bone), Majja (marrow), Sandhi Sleshaka Kapha, Rasa Dhatu",
      srotas: "Asthivaha, Annavaha, Purishavaha Srotas",
      srotodushtiPrakara: "Sanga (obstruction) and Sira-granthi (nodular joint stiffness)",
      udbhavaSthana: "Pakwashaya (Colon / Seat of Vata) & Amashaya (Stomach / Seat of Pitta)",
      vyaktiSthana: "Janu Sandhi (Bilateral Knee Joints) & Urdhwa Amashaya"
    },

    // Pariksha Modules
    trividhaPariksha: {
      darshana: "Mild joint swelling in right knee, subtle crepitus on flexion, pale-pink dry conjunctiva, tongue coated at posterior root.",
      sparshana: "Cold peripheral extremities, localized warmth at lateral knee margin, dry rough skin texture over pretibial area.",
      prashna: "Reports morning stiffness lasting 25 minutes, retrosternal burning after tea, relief with warm fomentation."
    },
    ashtavidhaPariksha: {
      nadi: { status: "Sarpa-Vata Gati", rate: "76 bpm", rhythm: "Slightly irregular, swift, prominent at index finger position." },
      mutra: { status: "Pitta-Vata Yukta", description: "Clear amber color, mild frequency, no dysuria or burning." },
      mala: { status: "Baddha & Shushka", description: "Hard, dry, dark consistency, mild Ama presence." },
      jihva: { status: "Saama Jihva", description: "Thin white coating at posterior third, dry tip, lateral tooth indentations." },
      shabda: { status: "Prakrita Shabda", description: "Clear articulation, moderate resonance, slight dry throat clearing." },
      sparsha: { status: "Ruksha & Anushna", description: "Dry, non-unctuous skin, cool to touch on hands and feet." },
      druk: { status: "Prakrita Druk", description: "Lustrous sclera, mild dryness, no icterus or redness." },
      akruti: { status: "Madhyama Akruti", description: "Normal stature, lean muscle distribution, slight posture stoop." }
    },
    dashavidhaPariksha: {
      dushya: "Asthi Dhatu, Sandhi Snayu, Rasa Dhatu",
      desha: "Sadharana Desha (Temperate inland climate)",
      bala: "Madhyama Bala (Moderate physical endurance & vitality)",
      kala: "Sharad Ritu (Autumnal season - Pitta Prakopa & Vata Sanchaya)",
      anala: "Vishama Agni",
      prakriti: "Pitta-Vataja",
      vaya: "Madhyama Vaya (52 years)",
      sattva: "Madhyama Sattva (Average mental fortitude, anxious under pain)",
      satmya: "Mishra Satmya (Adapted to north-central Indian diet)",
      aharaShakti: "Madhyama (Moderate digestive and assimilative capacity)"
    },

    // Key Findings & Summary
    keyFindings: [
      "Pronounced Vata aggravation (56% vs baseline 42%) causing joint dryness and localized crepitus.",
      "Vishama Agni manifesting as fluctuating appetite and post-prandial bloating.",
      "Saama tongue coating indicating subtle gastrointestinal endotoxin (Ama) accumulation.",
      "Sarpa-gati dominant pulse with rapid cadence reflecting autonomic sympathetic overdrive.",
      "Krura Koshtha requiring unctuous bowel regulation rather than harsh laxatives."
    ],
    clinicalSummary: "52-year-old male with Pitta-Vata Prakriti presenting with bilateral Sandhigata Vata (predominantly right knee) accompanied by mild Amlapitta. The pathogenesis stems from chronic dietary irregularities (Vata-vardhaka ahara), occupational sedentary habits, and suppression of natural urges (Vegadharana), resulting in Apana & Vyana Vayu vitiation with secondary Pachaka Pitta aggravation. Examination confirms Vishama Agni, Krura Koshtha, and Saama Jihva. Immediate management focuses on Deepana-Pachana to clear Ama, followed by Snehana and Mridu Anulomana for joint lubrication and systemic balance.",
    
    // Integrative AYUSH Chikitsa Plan
    treatmentPlan: {
      shamanaChikitsa: [
        { formulation: "Yogaraj Guggulu", dosage: "2 tablets twice daily", anupana: "Warm water after meals", indication: "Sandhi Shoola & Vata Shamana" },
        { formulation: "Avipattikar Churna", dosage: "3g at bedtime", anupana: "Lukewarm water", indication: "Pitta Pachana & mild bowel regulation" },
        { formulation: "Ashwagandha Ksheerapaka", dosage: "1 cup at night", anupana: "Warm milk with a pinch of nutmeg", indication: "Vata stabilization & sleep enhancement" }
      ],
      panchakarmaGuidance: [
        "Janu Basti with Ksheerabala Taila (7-day course)",
        "Patra Pinda Swedana for local knee stiffness",
        "Matra Basti with Sahacharadi Taila (60ml) after digestive normalization"
      ],
      pathya: [
        "Warm, freshly prepared meals with cow's ghee (1 tsp per meal)",
        "Mudga Yusha (warm moong soup), barley, bottle gourd, cooked leafy vegetables",
        "Abhyanga with sesame oil prior to warm bath 3 times weekly"
      ],
      apathya: [
        "Cold drinks, aerated beverages, refrigerated leftovers",
        "Excessive pungent (Katu) chillies, dry baked biscuits, raw salads at dinner",
        "Daytime napping (Divasvapna) and staying awake past 11 PM (Ratrijagarana)"
      ]
    }
  },
  {
    id: "CARE-810293",
    name: "Priya Venkatesh",
    age: 34,
    gender: "Female",
    bloodGroup: "O+",
    phone: "+91 94432 10987",
    occupation: "Software Architect",
    abhaId: "42-9182-3019-4820",
    lastVisit: "2026-09-02",
    assessedBy: "Dr. K. Swaminathan, BAMS",
    reviewStatus: "Clinician Verified",
    assessmentCompleteness: 98,
    
    prakriti: {
      type: "Kapha-Pitta (Dvandvaja)",
      primaryDosha: "Kapha",
      secondaryDosha: "Pitta",
      vataScore: 22,
      pittaScore: 36,
      kaphaScore: 42,
      physicalCharacteristics: "Sturdy build, thick lustrous hair, large clear eyes, moist smooth skin, stable gait.",
      mentalTemperament: "Calm, methodical, patient, deliberate decision-making, prone to lethargy when uninspired."
    },
    vikriti: {
      currentDosha: "Kapha Vriddhi with Medodhatvagni Mandya",
      vataScore: 18,
      pittaScore: 30,
      kaphaScore: 52,
      severity: "Mild-Moderate Aggravation",
      aggravatingFactors: "High carbohydrate breakfast, afternoon snacking, prolonged sitting at computer workstation."
    },
    agni: {
      category: "Manda Agni (Slow/Sluggish Digestive Fire)",
      description: "Appetite is low; patient feels full for 6-7 hours even after moderate meals. Heaviness in epigastrium.",
      jaranaShakti: "Avara to Madhyama (Prolonged digestion cycle)",
      abhyavaharanaShakti: "Pravara (Good appetite volume, but poor breakdown capacity)"
    },
    koshtha: {
      category: "Mridu Koshtha (Soft/Sensitive Bowel Motility)",
      description: "Easy, soft bowel evacuations, sensitive to dietary changes, occasional heaviness after dairy.",
      malotsargaFrequency: "1-2 times daily, soft well-formed stool with mild mucous traces."
    },
    aharaVihara: {
      dietaryHabits: "Sweet and heavy items (dairy, bakery products), irregular meal hours.",
      viruddhaAhara: "Yogurt at night, milk teas with salt savories.",
      satmya: "Rice, sambar, coconut oil preparations.",
      dinacharya: "Wake up at 7:30 AM, minimal physical exercise (<2000 steps daily).",
      nidra: "Deep, heavy sleep (8.5 hours), morning sluggishness (Alasya) upon waking."
    },
    nidana: {
      primaryEtiology: "Avyayama (sedentary lifestyle), Madhura & Snigdha Ahara ati-sevana, Divasvapna.",
      secondaryTriggers: "High mental stress managed through emotional eating."
    },
    samprapti: {
      rogaName: "Sthaulya (Metabolic Dysregulation / Overweight) & Kledaka Kapha Vriddhi",
      dosha: "Kapha Pradhana (Kledaka & Avalambaka Kapha)",
      dushya: "Meda Dhatu, Kleda, Rasa Dhatu",
      srotas: "Medovaha, Rasavaha Srotas",
      srotodushtiPrakara: "Atipravritti of Medas and Sanga in microchannels",
      udbhavaSthana: "Amashaya",
      vyaktiSthana: "Sarva Shareera (predominantly abdominal and thigh regions)"
    },
    trividhaPariksha: {
      darshana: "Plump habitus, clear skin with mild oiliness on forehead, bright moist eyes, smooth pink tongue with thin white coating.",
      sparshana: "Soft, smooth, cool skin; no edema; normal peripheral temperature.",
      prashna: "Complains of chronic post-meal lethargy, weight gain of 4.5 kg over 6 months, sweet cravings."
    },
    ashtavidhaPariksha: {
      nadi: { status: "Hamsa-Kapha Gati", rate: "68 bpm", rhythm: "Steady, slow, deep, undulating like a swan." },
      mutra: { status: "Prakrita / Avila", description: "Pale yellow, slightly cloudy in morning, normal frequency." },
      mala: { status: "Shithila", description: "Soft, floating, occasional mild mucus (Pichhila)." },
      jihva: { status: "Alpa-Lipta", description: "Moist, pink, mild uniform white film, no fissures." },
      shabda: { status: "Snigdha Shabda", description: "Deep, sweet, resonant voice." },
      sparsha: { status: "Snigdha & Sheeta", description: "Smooth, cool, unctuous tactile feel." },
      druk: { status: "Snigdha Druk", description: "White sclera, thick black eyelashes, calm gaze." },
      akruti: { status: "Sthoola Akruti", description: "Endomorphic build, well-lubricated joints." }
    },
    dashavidhaPariksha: {
      dushya: "Meda Dhatu, Kleda",
      desha: "Anupa Desha origin, currently living in Sadharana Desha",
      bala: "Pravara Bala (Good structural and immune baseline)",
      kala: "Vasanta / Greeshma context",
      anala: "Manda Agni",
      prakriti: "Kapha-Pitta",
      vaya: "Yuva / Madhyama Vaya (34 years)",
      sattva: "Pravara Sattva (Good psychological stability)",
      satmya: "Satmya to south Indian diet",
      aharaShakti: "Madhyama digestion capacity"
    },
    keyFindings: [
      "Dominant Kapha-Meda vitiation with Manda Agni causing metabolic sluggishness.",
      "Hamsa-gati pulse (68 bpm) reflecting slow vascular and metabolic rhythm.",
      "Clear indicators of Medodhatvagni Mandya with preserved muscle mass.",
      "Positive response expected from Langhana, Ushna virya spices, and brisk morning Vihara."
    ],
    clinicalSummary: "34-year-old female presenting with early-stage metabolic sluggishness (Sthaulya Purvaroopa) on a Kapha-Pitta constitutional foundation. Clinical examination demonstrates Manda Agni, Mridu Koshtha, and Hamsa-gati pulse. Etiology is linked to sedentary software work habits and excess Madhura/Snigdha intake. Primary therapeutic strategy entails Deepana-Pachana, Lekhana (scraping) herbs, and structured Dinacharya modifications.",
    treatmentPlan: {
      shamanaChikitsa: [
        { formulation: "Medohar Guggulu", dosage: "2 tablets twice daily", anupana: "Warm water 30 min before meals", indication: "Lekhana & Medo Dhatu regulation" },
        { formulation: "Trikatu Churna", dosage: "1.5g with 1 tsp honey", anupana: "Directly before lunch and dinner", indication: "Deepana & Kapha-Kleda Shamana" },
        { formulation: "Triphala Kwatha", dosage: "40 ml", anupana: "Warm, early morning", indication: "Srotoshodhana & gentle detox" }
      ],
      panchakarmaGuidance: [
        "Udwarthanam (Dry herbal powder massage with Kolakulathadi Churna) - 5 sessions",
        "Swedana (Bashpa Sweda) following dry massage"
      ],
      pathya: [
        "Warm honey-lemon water first thing in morning",
        "Old barley (Yava), millets, green gram (Mudga), roasted spices (Jeera, Ajwain)",
        "Brisk 40-minute morning walk in open sunlight"
      ],
      apathya: [
        "Cold milk, cream, paneer, sweet confectionery, deep-fried snacks",
        "Sleeping within 2 hours of food intake",
        "Total daytime sedentary inactivity"
      ]
    }
  },
  {
    id: "CARE-651920",
    name: "Amitabh Sengupta",
    age: 61,
    gender: "Male",
    bloodGroup: "A+",
    phone: "+91 98301 23456",
    occupation: "Retired College Principal",
    abhaId: "23-8910-4019-2049",
    lastVisit: "2026-08-28",
    assessedBy: "Dr. Arvind Vaidya, BAMS, MD (Ayu)",
    reviewStatus: "Pending Specialist Review",
    assessmentCompleteness: 86,
    
    prakriti: {
      type: "Vata-Kapha (Dvandvaja)",
      primaryDosha: "Vata",
      secondaryDosha: "Kapha",
      vataScore: 48,
      pittaScore: 16,
      kaphaScore: 36,
      physicalCharacteristics: "Tall, prominent joints, dry skin on extremities, cold tolerance is low.",
      mentalTemperament: "Reflective, intellectually sharp, sensitive to environmental noise, prone to worry."
    },
    vikriti: {
      currentDosha: "Prana-Vyana Vata Prakopa with Hridaya Daurbalya",
      vataScore: 62,
      pittaScore: 18,
      kaphaScore: 20,
      severity: "Moderate-High Aggravation",
      aggravatingFactors: "Emotional stress regarding pension documents, dry Kolkata winter wind, irregular sleep."
    },
    agni: {
      category: "Vishama Agni",
      description: "Severe appetite unpredictability, occasional bloating and gas rumbling.",
      jaranaShakti: "Avara (Weak digestion pace)",
      abhyavaharanaShakti: "Madhyama"
    },
    koshtha: {
      category: "Krura Koshtha",
      description: "Dry, infrequent bowel movements; requires warm water and Triphala routinely.",
      malotsargaFrequency: "Once in 36-48 hours without herbal support."
    },
    aharaVihara: {
      dietaryHabits: "Low appetite, prefers light warm rice soup, occasionally skips evening dinner.",
      viruddhaAhara: "Very few; minimal spicy food.",
      satmya: "Rice, fish, mustard oil in moderation.",
      dinacharya: "Early riser (5:00 AM), morning chanting, reading books.",
      nidra: "Interrupted, wakes up multiple times with heart awareness or dry throat."
    },
    nidana: {
      primaryEtiology: "Vriddha Vaya (geriatric phase where Vata naturally dominates), Chinta (mental rumination), Rooksha ahara.",
      secondaryTriggers: "Cold weather drafts and sedentary indoor posture."
    },
    samprapti: {
      rogaName: "Urdhwaga Vata (Chest Distension / Palpitations) & Sandhi Shoola",
      dosha: "Prana & Vyana Vayu",
      dushya: "Rasa, Rakta, Hridaya Srotas, Asthi Dhatu",
      srotas: "Pranavaha, Rasavaha, Manovaha Srotas",
      srotodushtiPrakara: "Vimargagamana (aberrant direction of Vata) & Sanga",
      udbhavaSthana: "Pakwashaya & Hridaya",
      vyaktiSthana: "Uras (Chest) & Manas"
    },
    trividhaPariksha: {
      darshana: "Lean physical habitus, dry skin, subtle hand tremor when outstretched, tongue dry and reddish at margins.",
      sparshana: "Cold palms and soles, pulse is rapid and thin, mild tenderness over epigastric marma points.",
      prashna: "Reports sensation of chest tightness during anxiety, chronic constipation, knee stiffness in morning."
    },
    ashtavidhaPariksha: {
      nadi: { status: "Sarpa-Gati Vata", rate: "82 bpm", rhythm: "Rapid, thready, prominent under index finger." },
      mutra: { status: "Prakrita", description: "Clear, pale, occasional nocturia once per night." },
      mala: { status: "Shushka", description: "Hard, dark, pebble-like stool." },
      jihva: { status: "Ruksha Jihva", description: "Dry, slightly fissured in midline, pale pink." },
      shabda: { status: "Mandara Shabda", description: "Soft, gentle voice, breaks slightly during extended sentences." },
      sparsha: { status: "Ruksha & Sheeta", description: "Cold, dry extremities." },
      druk: { status: "Alpa-Snigdha", description: "Dryness in eyes, clear sclera." },
      akruti: { status: "Krisha Akruti", description: "Ectomorphic, visible tendons on hands and feet." }
    },
    dashavidhaPariksha: {
      dushya: "Rasa, Asthi Dhatu",
      desha: "Sadharana Desha",
      bala: "Avara to Madhyama Bala",
      kala: "Hemanta / Shishira context",
      anala: "Vishama Agni",
      prakriti: "Vata-Kapha",
      vaya: "Vriddha Vaya (61 years)",
      sattva: "Madhyama Sattva",
      satmya: "Rice and warm soups",
      aharaShakti: "Avara (Low consumption volume)"
    },
    keyFindings: [
      "Severe Vata predominance (62%) in geriatric age group (Vriddha Vaya).",
      "Prana-Vyana Vayu disturbance manifesting as chest awareness and sleep disruption.",
      "Chronic Krura Koshtha exacerbating upward Vata movement (Urdhwaga Vata).",
      "Requires Rasayana therapy alongside gentle Deepana and Vata Shamana."
    ],
    clinicalSummary: "61-year-old male presenting with systemic Vata aggravation affecting the cardiorespiratory and musculoskeletal channels (Pranavaha & Asthivaha Srotas). Core diagnosis indicates Prana-Vyana Vata disturbance with underlying Vishama Agni and chronic Krura Koshtha. Treatment plan emphasizes grounding Vata-shamak medicines, Medhya Rasayana, and gentle daily oil application.",
    treatmentPlan: {
      shamanaChikitsa: [
        { formulation: "Arjuna Ksheerapaka", dosage: "1 cup twice daily", anupana: "Warm with half tsp mishri", indication: "Hridaya Balya & circulation" },
        { formulation: "Brahmi Vati (Gold)", dosage: "1 tablet morning", anupana: "With warm milk", indication: "Manasika Shanti & Prana Vata regulation" },
        { formulation: "Gandharvahastadi Castor Oil", dosage: "5 ml in warm milk", anupana: "At bedtime twice weekly", indication: "Mridu Vatanulomana" }
      ],
      panchakarmaGuidance: [
        "Shirodhara with Ksheerabala Taila (45 mins x 7 days)",
        "Hrid Basti with warm Til Taila (for chest comfort)"
      ],
      pathya: [
        "Cooked basmati rice with warm cow's ghee, mashed mung beans, sweet fruits (pomegranate, soaked raisins)",
        "Gentle Nadi Shodhana Pranayama (10 mins morning and evening)",
        "Keeping ears and head covered in cold drafts"
      ],
      apathya: [
        "Dry crackers, millet flour without ghee, raw salads, cold milkshakes",
        "Excessive fasting or skipping meals",
        "Watching distressing news or bright screens late at night"
      ]
    }
  }
];

export default function AyushClinicalDashboard({
  patient = null,
  allPatients = [],
  onSelectPatient = () => {},
  onBack = () => {},
  showToast = () => {}
}) {
  // Select active patient from mock registry or fallback
  const [selectedPatientId, setSelectedPatientId] = useState(
    patient?.id || MOCK_AYUSH_PATIENTS[0].id
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'dimensions' | 'pariksha' | 'treatment'
  const [selectedDimension, setSelectedDimension] = useState('prakriti');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [physicianNotes, setPhysicianNotes] = useState('');
  const [isReviewedState, setIsReviewedState] = useState(true);

  // Find selected patient in mock registry or fallback to first
  const activeAyushPatient = 
    MOCK_AYUSH_PATIENTS.find(p => p.id === selectedPatientId) || 
    MOCK_AYUSH_PATIENTS[0];

  const handlePatientSelect = (pid) => {
    setSelectedPatientId(pid);
    if (typeof onSelectPatient === 'function') {
      onSelectPatient(pid);
    }
    if (typeof showToast === 'function') {
      const p = MOCK_AYUSH_PATIENTS.find(x => x.id === pid);
      showToast(`Loaded AYUSH clinical record for ${p?.name || pid}`, 'success');
    }
  };

  const handlePrintSheet = () => {
    window.print();
  };

  const handleSaveReview = () => {
    setIsReviewedState(true);
    setShowReviewModal(false);
    if (typeof showToast === 'function') {
      showToast('AYUSH Clinical Assessment verified and signed by attending Vaidya.', 'success');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">

      {/* =======================================================================
          1. AYUSH OVERVIEW BANNER & HEADER (Compact Dashboard Header)
         ======================================================================= */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white rounded-xl p-3.5 lg:p-4 shadow-md relative overflow-hidden border border-emerald-800/40">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 space-y-2.5">
          {/* Top row: Title + Badges + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" /> AYUSH Module
              </span>
              <h1 className="text-lg lg:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>AYUSH Clinical Assessment</span>
              </h1>
              <span className="text-[10px] text-emerald-200/80 font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 hidden sm:inline">
                NAMASTE Aligned
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>
              <button
                type="button"
                onClick={handlePrintSheet}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Sheet
              </button>
            </div>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed max-w-3xl">
            Captures structured Ayurvedic clinical assessment (Prakriti-Vikriti, Agni, Koshtha, Pariksha frameworks, and Pathya-Apathya) harmonized with patient longitudinal records.
          </p>

          {/* Quick Mock Patient Selector */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
            <span className="text-[11px] font-bold text-slate-300 mr-1 flex items-center gap-1">
              <User className="w-3 h-3 text-emerald-400" /> Patient:
            </span>
            {MOCK_AYUSH_PATIENTS.map((p) => {
              const isSelected = p.id === activeAyushPatient.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePatientSelect(p.id)}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs' 
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>
                    ({p.prakriti.type.split(' ')[0]})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =======================================================================
          2. PATIENT BIO & AYUSH QUICK VITALS STRIP (Compact Horizontal Layout)
         ======================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 lg:p-3.5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              {activeAyushPatient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm lg:text-base font-extrabold text-slate-800">{activeAyushPatient.name}</h2>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                  {activeAyushPatient.id}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-medium">
                  ABHA: {activeAyushPatient.abhaId}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {activeAyushPatient.age} yrs • {activeAyushPatient.gender} • Blood Group: {activeAyushPatient.bloodGroup} • {activeAyushPatient.occupation}
              </p>
            </div>
          </div>

          {/* AYUSH Cardinal Metrics - Compact Horizontal Row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-left">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Prakriti</span>
              <span className="text-[11px] font-extrabold text-emerald-800 leading-tight">{activeAyushPatient.prakriti.type}</span>
            </div>

            <div className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-left">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Agni</span>
              <span className="text-[11px] font-extrabold text-amber-800 leading-tight">{activeAyushPatient.agni.category.split(' ')[0]}</span>
            </div>

            <div className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-left">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Koshtha</span>
              <span className="text-[11px] font-extrabold text-indigo-800 leading-tight">{activeAyushPatient.koshtha.category.split(' ')[0]}</span>
            </div>

            <div className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-left">
              <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-700 block leading-tight">Status</span>
              <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1 leading-tight">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {activeAyushPatient.assessmentCompleteness}% Complete
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-teal-300 hover:text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ml-auto lg:ml-0"
            >
              <Stethoscope className="w-3.5 h-3.5 text-teal-400" /> Review & Sign
            </button>
          </div>
        </div>
      </div>

      {/* =======================================================================
          3. VISUAL DOSHA BALANCE & ASSESSMENT METRICS STRIP
         ======================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">

        {/* Dosha Balance Comparison (Prakriti vs Vikriti) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-3.5 lg:p-4 shadow-xs space-y-2.5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600" /> Tridosha Profile: Prakriti (Baseline) vs. Vikriti (Current)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Constitutional baseline vs active pathological dosha distortion
              </p>
            </div>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold">
              {activeAyushPatient.vikriti.severity}
            </span>
          </div>

          <div className="space-y-2 pt-0.5">
            {/* Vata Bar */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-sky-600" /> Vata (Movement & Catabolism)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Baseline: <strong>{activeAyushPatient.prakriti.vataScore}%</strong> → Current: <strong className="text-sky-700">{activeAyushPatient.vikriti.vataScore}%</strong>
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                <div 
                  className="h-full bg-sky-500 rounded-full transition-all duration-500" 
                  style={{ width: `${activeAyushPatient.vikriti.vataScore}%` }}
                ></div>
              </div>
            </div>

            {/* Pitta Bar */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-600" /> Pitta (Transformation & Metabolism)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Baseline: <strong>{activeAyushPatient.prakriti.pittaScore}%</strong> → Current: <strong className="text-amber-700">{activeAyushPatient.vikriti.pittaScore}%</strong>
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                  style={{ width: `${activeAyushPatient.vikriti.pittaScore}%` }}
                ></div>
              </div>
            </div>

            {/* Kapha Bar */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-emerald-600" /> Kapha (Structure & Anabolism)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Baseline: <strong>{activeAyushPatient.prakriti.kaphaScore}%</strong> → Current: <strong className="text-emerald-700">{activeAyushPatient.vikriti.kaphaScore}%</strong>
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${activeAyushPatient.vikriti.kaphaScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
            <div className="text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Clinical Dosha Variance: </strong>
              {activeAyushPatient.vikriti.currentDosha}. Aggravated by {activeAyushPatient.vikriti.aggravatingFactors}
            </div>
          </div>
        </div>

        {/* Assessment Status & Verification Widget */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 lg:p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Consultation & Review Status
            </span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">{activeAyushPatient.reviewStatus}</h4>
                <p className="text-[10px] text-slate-400">Assessed: {activeAyushPatient.lastVisit}</p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Attending Vaidya:</span>
                <strong className="text-slate-800">{activeAyushPatient.assessedBy}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>NAMASTE Code:</span>
                <strong className="font-mono text-slate-800">NAM-AYU-2049</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Follow-Up Due:</span>
                <strong className="text-emerald-700">14 Days (Outpatient)</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> View Full Assessment Sheet
          </button>
        </div>

      </div>

      {/* =======================================================================
          4. AYUSH CLINICAL SUMMARY CARD (Prominent & Readable)
         ======================================================================= */}
      <div className="bg-white border border-emerald-500/30 rounded-xl p-3.5 lg:p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">
                AYUSH Clinical Assessment & Diagnostic Summary
              </h3>
              <p className="text-[11px] text-slate-400">Standardized Ayurvedic clinical impression and pathogenesis overview</p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
            Roga Vinischaya: {activeAyushPatient.samprapti.rogaName}
          </span>
        </div>

        <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/60 p-3 rounded-lg border border-slate-200">
          {activeAyushPatient.clinicalSummary}
        </p>

        {/* Diagnostic Snapshot Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Dravya / Dushya</span>
            <span className="text-xs font-bold text-slate-800">{activeAyushPatient.samprapti.dushya}</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Srotas Affected</span>
            <span className="text-xs font-bold text-slate-800">{activeAyushPatient.samprapti.srotas}</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Udbhava Sthana</span>
            <span className="text-xs font-bold text-slate-800">{activeAyushPatient.samprapti.udbhavaSthana}</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Vyakti Sthana</span>
            <span className="text-xs font-bold text-slate-800">{activeAyushPatient.samprapti.vyaktiSthana}</span>
          </div>
        </div>
      </div>

      {/* =======================================================================
          5. KEY FINDINGS / SALIENT OBSERVATIONS
         ======================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 lg:p-4 shadow-xs space-y-2.5">
        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600" /> Salient Clinical Findings & Pariksha Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {activeAyushPatient.keyFindings.map((finding, idx) => (
            <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/80 border border-slate-200 text-xs">
              <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                {idx + 1}
              </div>
              <p className="text-slate-700 leading-relaxed">{finding}</p>
            </div>
          ))}
        </div>
      </div>

      {/* =======================================================================
          6. TABBED DETAILED CLINICAL SECTIONS (Dimensions, Pariksha, Treatment)
         ======================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-3 pt-2 overflow-x-auto gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'overview'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Core Assessment Dimensions
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pariksha')}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'pariksha'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Traditional Pariksha (Trividha, Ashtavidha, Dashavidha)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('treatment')}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'treatment'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Leaf className="w-3.5 h-3.5" /> Chikitsa & Pathya-Apathya Protocol
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-3.5 lg:p-4">

          {/* TAB 1: CORE ASSESSMENT DIMENSIONS */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                
                {/* Card 1: Prakriti */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Deha & Manasa Prakriti
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                      {activeAyushPatient.prakriti.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <strong>Physical:</strong> {activeAyushPatient.prakriti.physicalCharacteristics}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Temperament:</strong> {activeAyushPatient.prakriti.mentalTemperament}
                  </p>
                </div>

                {/* Card 2: Vikriti */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Pathological Vikriti
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                      {activeAyushPatient.vikriti.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-semibold">
                    {activeAyushPatient.vikriti.currentDosha}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Triggers:</strong> {activeAyushPatient.vikriti.aggravatingFactors}
                  </p>
                </div>

                {/* Card 3: Agni */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" /> Jatharagni Status
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-900">
                      {activeAyushPatient.agni.category.split(' ')[0]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {activeAyushPatient.agni.description}
                  </p>
                  <div className="text-[11px] text-slate-500 pt-0.5 space-y-0.5">
                    <div>Jarana: <strong>{activeAyushPatient.agni.jaranaShakti}</strong></div>
                    <div>Abhyavaharana: <strong>{activeAyushPatient.agni.abhyavaharanaShakti}</strong></div>
                  </div>
                </div>

                {/* Card 4: Koshtha */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5" /> Koshtha (Bowel Motility)
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900">
                      {activeAyushPatient.koshtha.category.split(' ')[0]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {activeAyushPatient.koshtha.description}
                  </p>
                  <p className="text-[11px] text-slate-500 pt-0.5">
                    <strong>Evacuation:</strong> {activeAyushPatient.koshtha.malotsargaFrequency}
                  </p>
                </div>

                {/* Card 5: Ahara & Vihara */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1">
                      <Leaf className="w-3.5 h-3.5" /> Ahara & Vihara Pattern
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Diet & Lifestyle</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <strong>Ahara:</strong> {activeAyushPatient.aharaVihara.dietaryHabits}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Viruddha (Incompatible):</strong> {activeAyushPatient.aharaVihara.viruddhaAhara}
                  </p>
                  <p className="text-[11px] text-slate-500 pt-0.5">
                    <strong>Nidra:</strong> {activeAyushPatient.aharaVihara.nidra}
                  </p>
                </div>

                {/* Card 6: Nidana & Causative Factors */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> Nidana (Etiology)
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Triggers</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <strong>Primary:</strong> {activeAyushPatient.nidana.primaryEtiology}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Environmental:</strong> {activeAyushPatient.nidana.secondaryTriggers}
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: TRADITIONAL PARIKSHA (Trividha, Ashtavidha, Dashavidha) */}
          {activeTab === 'pariksha' && (
            <div className="space-y-4">

              {/* 1. Trividha Pariksha */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-emerald-600" /> Trividha Pariksha (Threefold Diagnostic Examination)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      1. Darshana (Inspection)
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {activeAyushPatient.trividhaPariksha.darshana}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
                      2. Sparshana (Palpation)
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {activeAyushPatient.trividhaPariksha.sparshana}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block">
                      3. Prashna (Interrogation)
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {activeAyushPatient.trividhaPariksha.prashna}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Ashtavidha Pariksha Matrix */}
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-teal-600" /> Ashtavidha Pariksha (Eightfold Clinical Pariksha)
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    8/8 Complete
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Nadi */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">1. Nadi (Pulse)</span>
                      <span className="text-[10px] font-bold text-sky-700">{activeAyushPatient.ashtavidhaPariksha.nadi.rate}</span>
                    </div>
                    <strong className="text-xs text-slate-800 block">{activeAyushPatient.ashtavidhaPariksha.nadi.status}</strong>
                    <p className="text-[11px] text-slate-500 leading-snug">{activeAyushPatient.ashtavidhaPariksha.nadi.rhythm}</p>
                  </div>

                  {/* Mutra */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">2. Mutra (Urine)</span>
                      <span className="text-[10px] font-bold text-amber-700">{activeAyushPatient.ashtavidhaPariksha.mutra.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{activeAyushPatient.ashtavidhaPariksha.mutra.description}</p>
                  </div>

                  {/* Mala */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">3. Mala (Stool)</span>
                      <span className="text-[10px] font-bold text-indigo-700">{activeAyushPatient.ashtavidhaPariksha.mala.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{activeAyushPatient.ashtavidhaPariksha.mala.description}</p>
                  </div>

                  {/* Jihva */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">4. Jihva (Tongue)</span>
                      <span className="text-[10px] font-bold text-rose-700">{activeAyushPatient.ashtavidhaPariksha.jihva.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{activeAyushPatient.ashtavidhaPariksha.jihva.description}</p>
                  </div>

                  {/* Shabda */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">5. Shabda (Voice)</span>
                      <span className="text-[10px] font-bold text-slate-700">{activeAyushPatient.ashtavidhaPariksha.shabda.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{activeAyushPatient.ashtavidhaPariksha.shabda.description}</p>
                  </div>

                  {/* Sparsha */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">6. Sparsha (Touch)</span>
                      <span className="text-[10px] font-bold text-teal-700">{activeAyushPatient.ashtavidhaPariksha.sparsha.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{activeAyushPatient.ashtavidhaPariksha.sparsha.description}</p>
                  </div>

                  {/* Druk */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">7. Druk (Eyes)</span>
                      <span className="text-[10px] font-bold text-slate-700">{activeAyushPatient.ashtavidhaPariksha.druk.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{activeAyushPatient.ashtavidhaPariksha.druk.description}</p>
                  </div>

                  {/* Akruti */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400">8. Akruti (Posture)</span>
                      <span className="text-[10px] font-bold text-slate-700">{activeAyushPatient.ashtavidhaPariksha.akruti.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{activeAyushPatient.ashtavidhaPariksha.akruti.description}</p>
                  </div>
                </div>
              </div>

              {/* 3. Dashavidha Pariksha Table/Strip */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" /> Dashavidha Pariksha (Tenfold Investigation Framework)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">1. Dushya</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.dushya}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">2. Desha</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.desha}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">3. Bala</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.bala}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">4. Kala (Ritu)</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.kala}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">5. Anala (Agni)</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.anala}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">6. Prakriti</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.prakriti}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">7. Vaya (Age)</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.vaya}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">8. Sattva (Mind)</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.sattva}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">9. Satmya</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.satmya}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">10. Ahara Shakti</span>
                    <strong className="text-slate-800 text-[11px]">{activeAyushPatient.dashavidhaPariksha.aharaShakti}</strong>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: TREATMENT PROTOCOL & PATHYA-APATHYA */}
          {activeTab === 'treatment' && (
            <div className="space-y-4">
              
              {/* Formulations */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-600" /> Prescribed Shamana Formulations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {activeAyushPatient.treatmentPlan.shamanaChikitsa.map((med, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-emerald-200/80 bg-emerald-50/30 space-y-1.5">
                      <div className="flex justify-between items-start">
                        <strong className="text-xs font-bold text-emerald-950">{med.formulation}</strong>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          {med.dosage}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        <strong>Anupana:</strong> {med.anupana}
                      </p>
                      <p className="text-[11px] text-emerald-800 font-medium pt-0.5">
                        🎯 {med.indication}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panchakarma Guidance */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <HeartPulse className="w-3.5 h-3.5 text-teal-600" /> Panchakarma & Upakarma Procedures
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {activeAyushPatient.treatmentPlan.panchakarmaGuidance.map((pk, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0"></div>
                      <span className="text-slate-700 font-medium">{pk}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pathya (Do's) vs Apathya (Don'ts) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Pathya */}
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-1.5">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Pathya (Recommended Diet & Regimens)
                  </h5>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {activeAyushPatient.treatmentPlan.pathya.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Apathya */}
                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/40 space-y-1.5">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Apathya (Contraindicated Foods & Habits)
                  </h5>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {activeAyushPatient.treatmentPlan.apathya.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-600 font-bold">✕</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* =======================================================================
          7. FULL AYUSH CLINICAL ASSESSMENT REVIEW MODAL
         ======================================================================= */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Leaf className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold">AYUSH Physician Review & Sign-Off</h3>
                  <p className="text-[11px] text-slate-400">Patient: {activeAyushPatient.name} ({activeAyushPatient.id})</p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Comprehensive Diagnostic Finding
                </span>
                <p className="text-slate-800 leading-relaxed">{activeAyushPatient.clinicalSummary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Verified Prakriti</span>
                  <span className="font-bold text-slate-800">{activeAyushPatient.prakriti.type}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Vikriti</span>
                  <span className="font-bold text-slate-800">{activeAyushPatient.vikriti.currentDosha}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Attending Vaidya / AYUSH Specialist Clinical Sign-Off Notes:
                </label>
                <textarea
                  rows={3}
                  value={physicianNotes}
                  onChange={(e) => setPhysicianNotes(e.target.value)}
                  placeholder="Enter specific therapeutic response observations, dosage adjustments, or Panchakarma scheduling..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex justify-between items-center text-[11px] text-slate-600">
                <span>NAMASTE Code: <strong>NAM-AYU-2049</strong></span>
                <span>Registry: <strong>AyuSeva Longitudinal EHR v2.4</strong></span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveReview}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Sign & Complete Review
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
