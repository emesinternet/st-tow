import {
  WORD_MODE_NORMAL,
  WORD_MODE_SYMBOLS,
  WORD_MODE_TECH,
} from '../../core/constants';

export type WordMode =
  | typeof WORD_MODE_NORMAL
  | typeof WORD_MODE_TECH
  | typeof WORD_MODE_SYMBOLS;

export type WordDifficultyTier = 1 | 2 | 3 | 4 | 5;

export type WordType =
  | 'object'
  | 'action'
  | 'abstract'
  | 'nature'
  | 'command'
  | 'flag'
  | 'operator'
  | 'path_token'
  | 'brace_pattern'
  | 'pipe_pattern'
  | 'mixed_token';

export interface WordEntry {
  value: string;
  mode: WordMode;
  tier: WordDifficultyTier;
  type: WordType;
}

interface TierWordSource {
  object: readonly string[];
  action: readonly string[];
  abstract: readonly string[];
  nature: readonly string[];
}

interface TierTechSource {
  command: readonly string[];
  flag: readonly string[];
  operator: readonly string[];
  path_token: readonly string[];
}

interface TierSymbolsSource {
  brace_pattern: readonly string[];
  pipe_pattern: readonly string[];
  mixed_token: readonly string[];
}

function addWordEntries(
  mode: WordMode,
  tier: WordDifficultyTier,
  type: WordType,
  values: readonly string[],
  target: WordEntry[]
): void {
  for (const value of values) {
    target.push({
      value,
      mode,
      tier,
      type,
    });
  }
}

function alphaTag(index: number): string {
  let value = index;
  let tag = '';
  do {
    const code = value % 26;
    tag = String.fromCharCode(97 + code) + tag;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return tag;
}

function composeExpandedCandidate(
  type: WordType,
  left: string,
  right: string
): string {
  if (type === 'brace_pattern') {
    return `{${left}|${right}}`;
  }
  if (type === 'pipe_pattern') {
    return `${left}|${right}`;
  }
  if (type === 'mixed_token') {
    return `${left}&&${right}`;
  }
  if (type === 'flag') {
    return `${left}-${right.replace(/^-+/, '')}`;
  }
  if (type === 'path_token') {
    return `${left}/${right.replace(/^\/+/, '')}`;
  }
  return `${left}${right}`;
}

function addExpandedEntries(
  mode: WordMode,
  tier: WordDifficultyTier,
  type: WordType,
  values: readonly string[],
  target: WordEntry[],
  used: Set<string>
): void {
  addWordEntries(mode, tier, type, values, target);
  for (const value of values) {
    used.add(value);
  }

  if (values.length === 0) {
    return;
  }

  const expanded: string[] = [];
  const offset = values.length > 1 ? (tier % (values.length - 1)) + 1 : 0;
  for (let index = 0; index < values.length; index += 1) {
    const left = values[index];
    const right = values[(index + offset) % values.length];
    const baseCandidate = composeExpandedCandidate(type, left, right);
    let candidate = baseCandidate;
    let bump = 0;
    while (used.has(candidate) && bump < 64) {
      candidate = `${baseCandidate}${alphaTag(bump)}`;
      bump += 1;
    }
    if (used.has(candidate)) {
      throw new Error(`could not derive unique expanded word for ${mode}/${tier}/${type}`);
    }
    used.add(candidate);
    expanded.push(candidate);
  }

  addWordEntries(mode, tier, type, expanded, target);
}

const NORMAL_TIER_WORDS: Record<WordDifficultyTier, TierWordSource> = {
  1: {
    object: [
      'anchor',
      'beacon',
      'bucket',
      'candle',
      'drum',
      'fence',
      'gadget',
      'helmet',
      'jacket',
      'ladder',
      'lantern',
      'marble',
      'needle',
      'parcel',
      'rocket',
    ],
    action: [
      'align',
      'build',
      'carry',
      'clean',
      'climb',
      'draft',
      'drive',
      'gather',
      'grind',
      'hover',
      'launch',
      'polish',
      'press',
      'repair',
      'stack',
    ],
    abstract: [
      'balance',
      'belief',
      'calm',
      'clarity',
      'focus',
      'glory',
      'grace',
      'honor',
      'joy',
      'merit',
      'order',
      'patience',
      'rhythm',
      'spirit',
      'trust',
    ],
    nature: [
      'breeze',
      'brook',
      'cedar',
      'cloud',
      'dawn',
      'ember',
      'fern',
      'grove',
      'harbor',
      'meadow',
      'pebble',
      'rain',
      'river',
      'sprout',
      'tide',
    ],
  },
  2: {
    object: [
      'armature',
      'barometer',
      'canister',
      'capsule',
      'compass',
      'detector',
      'gimbal',
      'harness',
      'hinge',
      'keyframe',
      'lockpick',
      'manifold',
      'plinth',
      'shuttle',
      'tripod',
    ],
    action: [
      'assemble',
      'calibrate',
      'compose',
      'deliver',
      'elevate',
      'engrave',
      'fasten',
      'forage',
      'funnel',
      'inflate',
      'inspect',
      'migrate',
      'navigate',
      'shelter',
      'weave',
    ],
    abstract: [
      'ambition',
      'courage',
      'discipline',
      'empathy',
      'friction',
      'harmony',
      'insight',
      'kinship',
      'momentum',
      'novelty',
      'parity',
      'resolve',
      'signal',
      'tenacity',
      'wonder',
    ],
    nature: [
      'aurora',
      'basalt',
      'canyon',
      'dolphin',
      'estuary',
      'glacier',
      'granite',
      'lagoon',
      'meteor',
      'monsoon',
      'reefline',
      'savanna',
      'summit',
      'thicket',
      'whirlwind',
    ],
  },
  3: {
    object: [
      'algorithm',
      'backplane',
      'cartogram',
      'chronicle',
      'diaphragm',
      'flywheel',
      'geartrain',
      'kaleidoscope',
      'microgrid',
      'nanotube',
      'oscillator',
      'periscope',
      'prototype',
      'quaternion',
      'telemetry',
    ],
    action: [
      'aggregate',
      'bootstrap',
      'categorize',
      'distribute',
      'elaborate',
      'fabricate',
      'harmonize',
      'illuminate',
      'interleave',
      'orchestrate',
      'parameterize',
      'reconcile',
      'synchronize',
      'triangulate',
      'visualize',
    ],
    abstract: [
      'abstraction',
      'coherence',
      'convergence',
      'equilibrium',
      'fidelity',
      'inference',
      'latency',
      'plurality',
      'resilience',
      'scarcity',
      'symmetry',
      'threshold',
      'topology',
      'variance',
      'velocity',
    ],
    nature: [
      'afterglow',
      'borealis',
      'cascade',
      'cyclone',
      'duststorm',
      'equinox',
      'geyser',
      'hinterland',
      'lightning',
      'ridgeback',
      'sandbar',
      'snowfield',
      'tremor',
      'watershed',
      'zephyrwind',
    ],
  },
  4: {
    object: [
      'autocorrelation',
      'cryptograph',
      'decomposition',
      'electromagnet',
      'hydrodynamic',
      'infrastructure',
      'juxtaposition',
      'microcontroller',
      'nanofabricator',
      'orthographic',
      'polymerization',
      'radioisotope',
      'semiconductor',
      'transmission',
      'wavefunction',
    ],
    action: [
      'circumnavigate',
      'deconstruct',
      'differentiate',
      'encapsulate',
      'generalize',
      'hypothesize',
      'institutionalize',
      'interconnect',
      'materialize',
      'parallelize',
      'recalibrate',
      'reconstitute',
      'reparameterize',
      'supersede',
      'transfigure',
    ],
    abstract: [
      'compositionality',
      'counterfactual',
      'determinism',
      'epistemology',
      'generalization',
      'homogeneity',
      'interoperability',
      'normalization',
      'optimality',
      'orthogonality',
      'pragmatism',
      'regularization',
      'specification',
      'stabilization',
      'tractability',
    ],
    nature: [
      'bioluminescence',
      'cryosphere',
      'deforestation',
      'electrostatic',
      'hydrology',
      'ionosphere',
      'lithosphere',
      'microclimate',
      'orographic',
      'permafrost',
      'photosynthesis',
      'stratosphere',
      'thermocline',
      'volcanology',
      'xerophytic',
    ],
  },
  5: {
    object: [
      'antidisestablishment',
      'counterbalancing',
      'decentralization',
      'electrophoresis',
      'hyperparameterization',
      'intercommunication',
      'micrometeorology',
      'multithreading',
      'neuroarchitecture',
      'overgeneralization',
      'polyfunctional',
      'pseudorandomness',
      'recontextualization',
      'thermoregulation',
      'ultrasonography',
    ],
    action: [
      'compartmentalize',
      'counterprogram',
      'decompartmentalize',
      'deinstitutionalize',
      'electrify',
      'hyperstabilize',
      'internationalize',
      'microbenchmark',
      'mischaracterize',
      'operationalize',
      'rearchitect',
      'reconceptualize',
      'reestablish',
      'reparameterizeplus',
      'transubstantiate',
    ],
    abstract: [
      'counterintuition',
      'decompositionality',
      'epiphenomenalism',
      'indeterminacy',
      'interdisciplinarity',
      'metastability',
      'nonlinearity',
      'phenomenology',
      'polysemy',
      'reproducibility',
      'selfsimilarity',
      'superposition',
      'teleology',
      'transcendence',
      'underfitting',
    ],
    nature: [
      'anthropogenicity',
      'biogeochemical',
      'chronostratigraphy',
      'electromigration',
      'geomorphology',
      'hydrocarbonates',
      'interglaciation',
      'magnetohydrodynamic',
      'paleoclimatology',
      'photosynthetically',
      'stratification',
      'tectonophysics',
      'thermoelasticity',
      'ultravioletindex',
      'volcanostratigraphy',
    ],
  },
};

const TECH_TIER_WORDS: Record<WordDifficultyTier, TierTechSource> = {
  1: {
    command: ['ls', 'cat', 'cd', 'pwd', 'echo', 'touch', 'mkdir'],
    flag: ['-a', '-l', '-h', '-v', '-n', '-r', '-f'],
    operator: ['&&', '||', '==', '!=', '+=', '-=', '*='],
    path_token: ['src/app', 'bin/run', '/tmp/log', './build', '../cache', '~/docs', '/var/tmp'],
  },
  2: {
    command: ['chmod', 'chown', 'grep', 'sed', 'awk', 'curl', 'tar'],
    flag: ['-help', '-force', '-verbose', '-silent', '-color', '-follow', '-dry-run'],
    operator: ['=>', '::', '->', '<=', '>=', '??', '?.'],
    path_token: ['src/server', 'web/src', '/etc/hosts', './scripts', '../assets', '~/workspace', '/opt/bin'],
  },
  3: {
    command: ['systemctl', 'journalctl', 'kubectl', 'docker', 'npm', 'pnpm', 'yarn'],
    flag: ['-watch', '-filter', '-target', '-output', '-stdin', '-stdout', '-json'],
    operator: ['|>', '===', '!==', '<<', '>>', '::=', '%%'],
    path_token: ['infra/terraform', 'config/nginx', '/usr/local/bin', './node_modules', '../dist/assets', '~/repos/st-tow', '/srv/runtime'],
  },
  4: {
    command: ['strace', 'lsof', 'iptables', 'dig', 'traceroute', 'openssl', 'rsync'],
    flag: ['-namespace', '-context', '-recursive', '-checksum', '-timeout', '-profile', '-parallel'],
    operator: ['>>=', '<<=', '&=', '|=', '^=', '<=>', '??='],
    path_token: ['cluster/prod/eu', 'services/auth/api', '/proc/net/tcp', './.github/workflows', '../terraform/modules', '~/kube/config', '/mnt/data/cache'],
  },
  5: {
    command: ['tcpdump', 'perf', 'wireshark', 'ansible-playbook', 'promtool', 'vault', 'consul'],
    flag: ['-max-connections', '-event-buffer', '-tls-sni', '-retry-backoff', '-no-preserve-root', '-only-show-errors', '-skip-verify'],
    operator: ['&&=', '||=', '>>>', '<<<', '=>=', '!==~', '/*/'],
    path_token: ['pipelines/deploy/prod', 'observability/alerts/rules', '/sys/fs/cgroup', './scripts/local/start_web.sh', '../server/dist/bundle.js', '~/repos/st-tow/web/src', '/var/lib/spacetimedb'],
  },
};

const SYMBOLS_TIER_WORDS: Record<WordDifficultyTier, TierSymbolsSource> = {
  1: {
    brace_pattern: ['{}', '[]', '()', '{[]}'],
    pipe_pattern: ['a|b', 'x||y', 'cat|grep', 'ls|wc'],
    mixed_token: ['{a}|b', '[x]=1', '(go)!', 'a+b=c'],
  },
  2: {
    brace_pattern: ['{foo}', '[bar]', '(baz)', '{x:[y]}'],
    pipe_pattern: ['grep|sort', 'cut|uniq', 'cat|sed', 'awk|wc'],
    mixed_token: ['a&&b||c', 'x->y::z', 'obj?.id', 'k=v&&ok'],
  },
  3: {
    brace_pattern: ['{a:{b:c}}', '[1,2,{x}]', '((alpha))', '{[()]}'],
    pipe_pattern: ['ps|grep|awk', 'cat|tr|sort', 'git|grep|wc', 'jq|sed|cat'],
    mixed_token: ['arr[i]+=1', 'fn(x)=>y', 'x??=y', 'path::to::id'],
  },
  4: {
    brace_pattern: ['{config:{env:{prod:true}}}', '[{a:1},{b:2}]', '(((())))', '{x:[{y:(z)}]}'],
    pipe_pattern: ['kubectl|get|jq', 'docker|ps|grep', 'npm|run|build', 'curl|jq|awk'],
    mixed_token: ['map<string,int>', 'x<<=2&&y', 'fn<t>(x:t)', 'a?.b?.c??d'],
  },
  5: {
    brace_pattern: ['{meta:{build:{id:42,ok:true}}}', '[{x:[{y:[z]}]}]', '({({[]})})', '{a:{b:{c:{d:e}}}}'],
    pipe_pattern: ['cat|grep|sort|uniq', 'tcpdump|grep|awk|wc', 'journalctl|grep|tail|sed', 'find|xargs|parallel|tee'],
    mixed_token: ['((a&&b)||c)&&!d', 'value::<<pipe>>::token', '{id:1}|{id:2}', 'cmd --flag="{x:y}"'],
  },
};

function buildCatalog(): WordEntry[] {
  const entries: WordEntry[] = [];
  const used = new Set<string>();

  const tiers: WordDifficultyTier[] = [1, 2, 3, 4, 5];
  for (const tier of tiers) {
    const normal = NORMAL_TIER_WORDS[tier];
    addExpandedEntries(WORD_MODE_NORMAL, tier, 'object', normal.object, entries, used);
    addExpandedEntries(WORD_MODE_NORMAL, tier, 'action', normal.action, entries, used);
    addExpandedEntries(WORD_MODE_NORMAL, tier, 'abstract', normal.abstract, entries, used);
    addExpandedEntries(WORD_MODE_NORMAL, tier, 'nature', normal.nature, entries, used);

    const tech = TECH_TIER_WORDS[tier];
    addExpandedEntries(WORD_MODE_TECH, tier, 'command', tech.command, entries, used);
    addExpandedEntries(WORD_MODE_TECH, tier, 'flag', tech.flag, entries, used);
    addExpandedEntries(WORD_MODE_TECH, tier, 'operator', tech.operator, entries, used);
    addExpandedEntries(WORD_MODE_TECH, tier, 'path_token', tech.path_token, entries, used);

    const symbols = SYMBOLS_TIER_WORDS[tier];
    addExpandedEntries(
      WORD_MODE_SYMBOLS,
      tier,
      'brace_pattern',
      symbols.brace_pattern,
      entries,
      used
    );
    addExpandedEntries(
      WORD_MODE_SYMBOLS,
      tier,
      'pipe_pattern',
      symbols.pipe_pattern,
      entries,
      used
    );
    addExpandedEntries(
      WORD_MODE_SYMBOLS,
      tier,
      'mixed_token',
      symbols.mixed_token,
      entries,
      used
    );
  }

  return entries;
}

export const WORD_CATALOG: readonly WordEntry[] = Object.freeze(buildCatalog());

export function countCatalogEntriesByMode(mode: WordMode): number {
  let total = 0;
  for (const entry of WORD_CATALOG) {
    if (entry.mode === mode) {
      total += 1;
    }
  }
  return total;
}
