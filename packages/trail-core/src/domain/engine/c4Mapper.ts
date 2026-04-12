// domain/engine/c4Mapper.ts — Map file paths to C4 model elements and features

export interface C4Element {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly boundaryId?: string;
}

export interface C4MappingResult {
  readonly elementId: string;
  readonly elementType: string;
  readonly elementName: string;
  readonly matchType: 'exact' | 'package_fallback';
}

/**
 * Map changed file paths to C4 model elements.
 *
 * Strategy 1: `file::` + filePath for exact match
 * Strategy 2: `packages/xxx/` -> `pkg_xxx` package fallback
 */
export function mapFilesToC4Elements(
  filePaths: readonly string[],
  elements: readonly C4Element[],
): C4MappingResult[] {
  const results: C4MappingResult[] = [];
  const seen = new Set<string>();

  const elementById = new Map<string, C4Element>();
  for (const el of elements) {
    elementById.set(el.id, el);
  }

  for (const filePath of filePaths) {
    // 1. Exact file match
    const fileId = `file::${filePath}`;
    const fileEl = elementById.get(fileId);
    if (fileEl && !seen.has(fileEl.id)) {
      results.push({
        elementId: fileEl.id,
        elementType: fileEl.type,
        elementName: fileEl.name,
        matchType: 'exact',
      });
      seen.add(fileEl.id);

      // Also add parent container/component via boundaryId chain
      let current = fileEl;
      while (current.boundaryId) {
        const parent = elementById.get(current.boundaryId);
        if (!parent || seen.has(parent.id)) break;
        results.push({
          elementId: parent.id,
          elementType: parent.type,
          elementName: parent.name,
          matchType: 'exact',
        });
        seen.add(parent.id);
        current = parent;
      }
      continue;
    }

    // 2. Package fallback: packages/xxx/ -> pkg_xxx
    const pkgMatch = /^packages\/([^/]+)\//.exec(filePath);
    if (pkgMatch) {
      const pkgId = `pkg_${pkgMatch[1]}`;
      if (!seen.has(pkgId)) {
        const pkgEl = elementById.get(pkgId);
        if (pkgEl) {
          results.push({
            elementId: pkgId,
            elementType: pkgEl.type,
            elementName: pkgEl.name,
            matchType: 'package_fallback',
          });
          seen.add(pkgId);
        }
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
//  Feature mapping
// ---------------------------------------------------------------------------

export interface Feature {
  readonly id: string;
  readonly name: string;
}

export interface FeatureMapping {
  readonly featureId: string;
  readonly elementId: string;
  readonly role: string;
}

export interface FeatureMappingResult {
  readonly featureId: string;
  readonly featureName: string;
  readonly role: string;
}

/**
 * Map affected C4 element IDs to features via featureMatrix mappings.
 */
export function mapC4ToFeatures(
  c4ElementIds: readonly string[],
  features: readonly Feature[],
  mappings: readonly FeatureMapping[],
): FeatureMappingResult[] {
  const elementIdSet = new Set(c4ElementIds);
  const featureById = new Map<string, Feature>();
  for (const f of features) {
    featureById.set(f.id, f);
  }

  const seen = new Set<string>();
  const results: FeatureMappingResult[] = [];

  for (const mapping of mappings) {
    if (!elementIdSet.has(mapping.elementId)) continue;
    if (seen.has(mapping.featureId)) continue;
    seen.add(mapping.featureId);

    const feature = featureById.get(mapping.featureId);
    if (!feature) continue;

    results.push({
      featureId: mapping.featureId,
      featureName: feature.name,
      role: mapping.role,
    });
  }

  return results;
}

/** Data structure for feature mapping configuration */
export interface FeatureData {
  readonly features: readonly Feature[];
  readonly mappings: readonly FeatureMapping[];
}
