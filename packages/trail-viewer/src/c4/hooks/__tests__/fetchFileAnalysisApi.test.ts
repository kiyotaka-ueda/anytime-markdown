import { buildFileAnalysisUrl } from '../fetchFileAnalysisApi';

describe('buildFileAnalysisUrl', () => {
  it('current tag', () => {
    expect(buildFileAnalysisUrl('http://localhost:9999', 'myrepo', 'current'))
      .toBe('http://localhost:9999/api/c4/file-analysis?repo=myrepo&tag=current');
  });

  it('release tag is URL-encoded', () => {
    expect(buildFileAnalysisUrl('http://localhost:9999', 'r', 'v1.2.3'))
      .toBe('http://localhost:9999/api/c4/file-analysis?repo=r&tag=v1.2.3');
  });

  it('repo with special chars is encoded', () => {
    expect(buildFileAnalysisUrl('http://localhost:9999', 'my repo', 'current'))
      .toBe('http://localhost:9999/api/c4/file-analysis?repo=my+repo&tag=current');
  });
});
