import { Box, Flex, Grid, Text } from '@radix-ui/themes';
import { ArrowUpDown, MapPin, Search, Shapes } from 'lucide-react';

import { Card, CardBody } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CategoryCascadeSelect } from './CategoryCascadeSelect';
import { formatAttributeValue, getAttributeChoiceLabel } from '../lib/attributeFormat';

export function ListingsFiltersSidebar({
  t,
  locale,
  sp,
  params,
  cats,
  govs,
  cities,
  neighborhoods,
  uniqueAttrDefs,
  attrLabel,
  searchDraft,
  setSearchDraft,
  setParam,
  classNames,
} = {}) {
  const filtersWrapClass = classNames?.filtersWrapClass || 'bb-filters';
  const filterSectionClass = classNames?.filterSectionClass || 'bb-filter-section';
  const filterControlClass = classNames?.filterControlClass || 'bb-filter-control';

  return (
    <Card>
        <Flex direction="column" gap="3" >
          <Box className={filterSectionClass}>
            <Flex direction="column" gap="3">
              <Box>
                <Flex align="center" gap="2" mb="2">
                  <Search size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                  <Text as="div" size="1" color="gray" weight="medium">
                    {t('listings_search_placeholder')}
                  </Text>
                </Flex>
                <Input
                  className={filterControlClass}
                  value={searchDraft}
                  placeholder={t('listings_search_placeholder')}
                  onChange={(e) => setSearchDraft(e.target.value)}
                />
              </Box>

              <Box>
                <Flex align="center" gap="2" mb="2">
                  <Shapes size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                  <Text as="div" size="1" color="gray" weight="medium">
                    {t('listings_category')}
                  </Text>
                </Flex>
                <CategoryCascadeSelect
                  categories={cats}
                  value={params.category}
                  onChange={(v) => setParam('category', v)}
                  locale={locale}
                  t={t}
                  leafOnly
                  deferChangeUntilLeaf
                  showSearch
                  showQuickPicks={false}
                  controlClassName={filterControlClass}
                />
              </Box>
            </Flex>

            <Box mt="3">
              <Box>
                <Flex align="center" gap="2" mb="2">
                  <ArrowUpDown size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                  <Text as="div" size="1" color="gray" weight="medium">
                    {t('listings_price')}
                  </Text>
                </Flex>
                <Flex gap="2">
                  <Input
                    className={filterControlClass}
                    value={(sp?.get?.('price_min') || '')}
                    placeholder={t('filter_min')}
                    inputMode="decimal"
                    onChange={(e) => setParam('price_min', e.target.value)}
                  />
                  <Input
                    className={filterControlClass}
                    value={(sp?.get?.('price_max') || '')}
                    placeholder={t('filter_max')}
                    inputMode="decimal"
                    onChange={(e) => setParam('price_max', e.target.value)}
                  />
                </Flex>
              </Box>
            </Box>
          </Box>

          <Box className={filterSectionClass}>
            <Flex direction="column" gap="3">
              <Box>
                <Flex align="center" gap="2" mb="2">
                  <MapPin size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                  <Text as="div" size="1" color="gray" weight="medium">
                    {t('listings_governorate')}
                  </Text>
                </Flex>
                <Select
                  className={filterControlClass}
                  value={params.governorate}
                  onChange={(e) => {
                    setParam('governorate', e.target.value);
                  }}
                >
                  <option value="">{t('listings_governorate')}</option>
                  {govs.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name_ar || g.name_en}
                    </option>
                  ))}
                </Select>
              </Box>

              <Box>
                <Flex align="center" gap="2" mb="2">
                  <MapPin size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                  <Text as="div" size="1" color="gray" weight="medium">
                    {t('listings_city')}
                  </Text>
                </Flex>
                <Select
                  className={filterControlClass}
                  value={params.city}
                  onChange={(e) => {
                    setParam('city', e.target.value);
                  }}
                  disabled={!params.governorate}
                >
                  <option value="">{t('listings_city')}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name_ar || c.name_en}
                    </option>
                  ))}
                </Select>
              </Box>

              <Box>
                <Flex align="center" gap="2" mb="2">
                  <MapPin size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                  <Text as="div" size="1" color="gray" weight="medium">
                    {t('listings_neighborhood')}
                  </Text>
                </Flex>
                <Select
                  className={filterControlClass}
                  value={params.neighborhood}
                  onChange={(e) => setParam('neighborhood', e.target.value)}
                  disabled={!params.city}
                >
                  <option value="">{t('listings_neighborhood')}</option>
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={String(n.id)}>
                      {n.name_ar || n.name_en}
                    </option>
                  ))}
                </Select>
              </Box>
            </Flex>
          </Box>

          {params.category && uniqueAttrDefs.length > 0 ? (
            <Box className={filterSectionClass}>
              <Grid gap="3" columns={{ initial: '1' }} align="end">
                {uniqueAttrDefs
                  .filter((d) => d && d.is_filterable)
                  .map((d) => {
                    const key = String(d.key || '');
                    const label = attrLabel(d);

                    if (!key) return null;

                    if (d.type === 'int' || d.type === 'decimal') {
                      const minKey = `attr_${key}__gte`;
                      const maxKey = `attr_${key}__lte`;
                      const minVal = sp?.get?.(minKey) || '';
                      const maxVal = sp?.get?.(maxKey) || '';
                      return (
                        <Box key={key}>
                          <Flex align="center" gap="2" mb="2">
                            <Shapes size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                            <Text as="div" size="1" color="gray" weight="medium">
                              {label}{d.unit ? ` (${d.unit})` : ''}
                            </Text>
                          </Flex>
                          <Flex gap="2">
                            <Input
                              className={filterControlClass}
                              value={minVal}
                              placeholder={t('filter_min')}
                              onChange={(e) => setParam(minKey, e.target.value)}
                            />
                            <Input
                              className={filterControlClass}
                              value={maxVal}
                              placeholder={t('filter_max')}
                              onChange={(e) => setParam(maxKey, e.target.value)}
                            />
                          </Flex>
                        </Box>
                      );
                    }

                    if (d.type === 'enum' && Array.isArray(d.choices)) {
                      const paramKey = `attr_${key}`;
                      const val = sp?.get?.(paramKey) || '';
                      return (
                        <Box key={key}>
                          <Flex align="center" gap="2" mb="2">
                            <Shapes size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                            <Text as="div" size="1" color="gray" weight="medium">
                              {label}
                            </Text>
                          </Flex>
                          <Select className={filterControlClass} value={val} onChange={(e) => setParam(paramKey, e.target.value)}>
                            <option value="">{label}</option>
                            {d.choices.map((c) => (
                              <option key={String(c)} value={String(c)}>
                                {getAttributeChoiceLabel(d, c, t) || String(c)}
                              </option>
                            ))}
                          </Select>
                        </Box>
                      );
                    }

                    if (d.type === 'bool') {
                      const paramKey = `attr_${key}`;
                      const val = sp?.get?.(paramKey) || '';
                      return (
                        <Box key={key}>
                          <Flex align="center" gap="2" mb="2">
                            <Shapes size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                            <Text as="div" size="1" color="gray" weight="medium">
                              {label}
                            </Text>
                          </Flex>
                          <Select className={filterControlClass} value={val} onChange={(e) => setParam(paramKey, e.target.value)}>
                            <option value="">{label}</option>
                            <option value="true">{formatAttributeValue(d, true, t)}</option>
                            <option value="false">{formatAttributeValue(d, false, t)}</option>
                          </Select>
                        </Box>
                      );
                    }

                    const paramKey = `attr_${key}__icontains`;
                    const val = sp?.get?.(paramKey) || '';
                    return (
                      <Box key={key}>
                        <Flex align="center" gap="2" mb="2">
                          <Shapes size={16} className="text-[var(--gray-11)]" aria-hidden="true" />
                          <Text as="div" size="1" color="gray" weight="medium">
                            {label}
                          </Text>
                        </Flex>
                        <Input className={filterControlClass} value={val} onChange={(e) => setParam(paramKey, e.target.value)} />
                      </Box>
                    );
                  })}
              </Grid>
            </Box>
          ) : null}
        </Flex>
    </Card>
  );
}
