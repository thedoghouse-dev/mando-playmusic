import { parseBlob, selectCover } from 'music-metadata';
import { metadataFields } from '../shared/metadata.js';
export async function readBrowserTags(file) {
  const parsed = await parseBlob(file, { duration: false });
  const fields = metadataFields(parsed), cover = selectCover(parsed.common.picture);
  if (cover?.data?.length && /^image\/(jpeg|png|webp|gif)$/i.test(cover.format)) {
    fields.artworkUrl = URL.createObjectURL(new Blob([cover.data], { type: cover.format }));
  }
  return fields;
}
