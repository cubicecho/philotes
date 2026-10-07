import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { BookUser, MapPin, UserRoundPlus } from '@/components/app-icons';
import { AddressList } from '@/components/domain/address/list';
import { ContactInfoList } from '@/components/domain/contact-info/list';
import type { PersonDetail, PersonStub } from '@/components/domain/person/detail-queries';
import { PersonIntroductions, type PersonWithLabels } from '@/components/domain/person/introductions';
import { PersonRelationships } from '@/components/domain/person/relationships';
import { SectionAdd } from '@/components/domain/person/section-add';
import { Section } from '@/components/section';

export interface PersonContactColumnProps {
  /** The person the page is about. */
  person: PersonDetail;
  /** Everyone in the caller's contacts, for the relationship picker. */
  allPersons: PersonStub[];
  /** The same people with their labels, which the suggested introductions match on. */
  allPersonsWithLabels: PersonWithLabels[];
  /** Called after anything in the column is added, changed or removed. */
  onChanged: () => void;
}

/** The first column of a person's page: how they were met, how to reach them, and who they know. */
export function PersonContactColumn({ person, allPersons, allPersonsWithLabels, onChanged }: PersonContactColumnProps) {
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [contactInfoDialogOpen, setContactInfoDialogOpen] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);

  const linkedPersonIds = new Set(person.relationships.map((r) => r.relatedPersonId));
  const otherPersonIds = allPersons.map((p) => p.id).filter((otherId) => otherId !== person.id);
  const allPersonsLinked = otherPersonIds.every((otherId) => linkedPersonIds.has(otherId));

  return (
    <View className="min-w-0 gap-6 lg:flex-1">
      {person.howWeMet ? (
        <Section
          surface="card"
          title="How We Met"
          contentClassName="gap-1"
          contentSlot={
            <>
              <Text className="text-foreground/60 text-sm">{person.howWeMet}</Text>
              {person.firstMetDate ? (
                <Text className="text-foreground/60 text-xs">
                  First met:{' '}
                  {new Date(person.firstMetDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              ) : null}
            </>
          }
        />
      ) : null}

      <Section
        surface="card"
        title="Contact Info"
        actionSlot={<SectionAdd iconSlot={<BookUser />} onPress={() => setContactInfoDialogOpen(true)} />}
        contentSlot={
          <ContactInfoList
            person={person}
            onAdd={onChanged}
            onDelete={onChanged}
            createOpen={contactInfoDialogOpen}
            onCreateOpenChange={setContactInfoDialogOpen}
          />
        }
      />

      <Section
        surface="card"
        title="Addresses"
        actionSlot={<SectionAdd iconSlot={<MapPin />} onPress={() => setAddressDialogOpen(true)} />}
        contentSlot={
          <AddressList
            fragmentRef={person}
            onAdd={onChanged}
            onDelete={onChanged}
            createOpen={addressDialogOpen}
            onCreateOpenChange={setAddressDialogOpen}
          />
        }
      />

      <Section
        surface="card"
        title="Relationships"
        actionSlot={
          // Stays focusable when there is nobody left to link, so the reason can be read.
          <ActionButton
            label="Add"
            content="Add"
            size="xs"
            variant="ghost"
            iconSlot={<UserRoundPlus />}
            disabled={allPersonsLinked}
            tooltip={allPersonsLinked}
            hint={allPersonsLinked ? 'Everyone is already linked' : undefined}
            onPress={() => setShowAddRelationship(true)}
          />
        }
        contentSlot={
          <PersonRelationships
            person={person}
            allPersons={allPersons}
            onDelete={onChanged}
            onAdd={onChanged}
            onEdit={onChanged}
            showAdd={showAddRelationship}
            onShowAdd={setShowAddRelationship}
          />
        }
      />

      <Section
        surface="card"
        title="Suggested Introductions"
        contentSlot={
          <ScrollView className="max-h-80" nestedScrollEnabled>
            <PersonIntroductions
              currentPersonId={person.id}
              currentPersonLabels={person.labels}
              allPersons={allPersonsWithLabels}
              linkedPersonIds={linkedPersonIds}
            />
          </ScrollView>
        }
      />
    </View>
  );
}
