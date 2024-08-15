import React, { useEffect, useState } from 'react';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

import { useTheme } from '@material-ui/core/styles';

import VirtualAssistant from '@patternfly/virtual-assistant/dist/dynamic/VirtualAssistant';
import ConversationAlert from '@patternfly/virtual-assistant/dist/esm/ConversationAlert';
import AssistantMessageEntry from '@patternfly/virtual-assistant/dist/dynamic/AssistantMessageEntry';
import UserMessageEntry from '@patternfly/virtual-assistant/dist/dynamic/UserMessageEntry';
import LoadingMessage from '@patternfly/virtual-assistant/dist/esm/LoadingMessage';
import SystemMessageEntry from '@patternfly/virtual-assistant/dist/esm/SystemMessageEntry';
import VirtualAssistantAction from '@patternfly/virtual-assistant/dist/dynamic/VirtualAssistantAction';
import {  TrashIcon } from '@patternfly/react-icons';

import { Page, PageSection, PageSectionVariants } from '@patternfly/react-core';


import '@patternfly/react-core/dist/styles/base.css';
import '@patternfly/react-styles';
import {
  Accordion,
  AccordionItem,
  AccordionContent,
  AccordionToggle,
} from '@patternfly/react-core';
import { ExpandableSection } from '@patternfly/react-core';
import Markdown from 'markdown-to-jsx';

import {
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  ValidatedOptions,
} from '@patternfly/react-core';

import '@patternfly/patternfly/patternfly-addons.css';

export const AISearchComponent = () => {
  // Constants
  const BOT = 'ai';
  const USER = 'human';
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');
  const theme = useTheme();
  const isDarkMode = theme.palette.type === 'dark';

  // State
  const [userInputMessage, setUserInputMessage] = useState<string>('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [agents, setAgents] = useState<any>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>({});

  const getAgents = () => {
    const requestOptions = {
      headers: { 'Content-Type': 'application/json' },
    };

    fetch(`${backendUrl}/api/proxy/backend/api/agents`, requestOptions)
      .then(response => response.json())
      .then(response => {
        setAgents(response.data);
        setSelectedAgent(response.data[0]);
      })
      .catch(_error => {
        setError(true);
        console.error(`Error fetching agents from backend`);
      });
  };

  const modifyPFCardStyle = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      .card-0-3-1 {
        height: 100% !important;
        max-height: 100% !important; /* Ensures the element doesn't grow beyond the parent's height */
        width: 100% !important;
        border-radius: 0 !important;
        overflow: hidden !important; /* Prevents overflow if content grows */
        box-sizing: border-box; /* Includes padding and border in height calculation */
        display: flex; /* Flexbox to manage layout within the parent */
      }

      .cardBody-0-3-6 {
        max-height: 100% !important;
      }
    `;
    // Append the style element to the document head
    document.head.appendChild(style);
  };

  useEffect(() => {
    getAgents();
    modifyPFCardStyle();
  }, []);
  useEffect(() => {
    // If the last message in the conversation is from the user and the bot is not typing, send the user query
    if (
      conversation.length > 0 &&
      conversation[conversation.length - 1].sender === USER &&
      !loading
    ) {
      sendUserQuery(1, conversation[conversation.length - 1].text);
    }
  }, [conversation]);

  useEffect(() => {
    if (loading) {
      setUserInputMessage('');
    }
  }, [loading]);

  const AgentSelector = () => {
    // add a label to this select

    return (
      <Form>
        <FormGroup label="Select an agent to chat with" fieldId="select-agent">
          <FormSelect
            id="select-agent"
            aria-label="Select an agent to chat with."
            value={selectedAgent.id}
            onChange={(_event, selection) => {
              const agent = getAgentById(selection);
              setSelectedAgent(agent);
            }}
          >
            {agents.map((agent, index) => (
              <FormSelectOption
                key={index}
                value={agent.id}
                label={agent.agent_name}
              />
            ))}
          </FormSelect>
        </FormGroup>
      </Form>
    );
  };
  const getAgentById = agentId => {
    return agents.find(agent => agent.id === parseInt(agentId));
  };

  const sendUserQuery = async (agentId: number, userQuery: any) => {
    setLoading(true);
    setError(false);

    if (userQuery !== '') {
      await fetch(
        `${backendUrl}/api/proxy/backend/api/agents/${selectedAgent.id}/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: userQuery,
            stream: false,
            prvMsgs: conversation,
          }),
          cache: 'no-cache',
        },
      )
        .then(response => response.json())
        .then(response => {
          setLoading(false);
          const conversationEntry = {
            text: response.text_content,
            sender: BOT,
            search_metadata: response.search_metadata,
          };
          setConversation([...conversation, conversationEntry]);
        })
        .catch(_error => {
          setLoading(false);
          setError(true);
          console.error(`Error fetching response from backend chat bot server`);
        });
    }
  };

  const SendMessageHandler = (msg: string) => {
    setUserInputMessage('');
    const conversationEntry = {
      text: msg,
      sender: USER,
    };
    setConversation([...conversation, conversationEntry]);
  };

  const makeAssistantMessageOptions = (entry: any) => {
    const options = [];
    if (!entry.search_metadata || entry.search_metadata.length === 0) {
      return options;
    }
    entry.search_metadata.forEach((element: any) => {
      options.push({
        title: element.metadata.filename,
        value: element.value,
      });
    });
    return options;
  };

  const Conversation = () => {
    return conversation.map((conversationEntry, index) => {
      if (conversationEntry.sender === USER) {
        return (
          <UserMessageEntry key={index}>
            {conversationEntry.text}
          </UserMessageEntry>
        );
      }
      if (conversationEntry.sender === BOT) {
        const options = makeAssistantMessageOptions(conversationEntry);
        return (
          <React.Fragment>
            <AssistantMessageEntry key={index}>
              {conversationEntry.text}
            </AssistantMessageEntry>
            <Citations conversationEntry={conversationEntry} />
          </React.Fragment>
        );
      }
      return null;
    });
  };

  const ShowLoadingMessage = () => {
    if (loading) {
      return <LoadingMessage />;
    }
    return null;
  };

  const ShowErrorMessage = () => {
    if (error) {
      return (
        <SystemMessageEntry>
          Error fetching response from backend chat bot server
        </SystemMessageEntry>
      );
    }
    return null;
  };

  const Citation = ({ citation }) => {
    console.log(citation);
    const [expanded, setExpanded] = useState(false);
    return (
      <AccordionItem>
        <AccordionToggle
          onClick={() => setExpanded(!expanded)}
          isExpanded={expanded}
        >
          {citation.metadata.filename}
        </AccordionToggle>
        <AccordionContent isHidden={!expanded}>
          <Markdown>{citation.page_content}</Markdown>
        </AccordionContent>
      </AccordionItem>
    );
  };

  const Citations = ({ conversationEntry }) => {
    const [expanded, setExpanded] = useState(false);
    const citations = conversationEntry.search_metadata.map(
      (citation, index) => {
        return <Citation key={index} citation={citation} />;
      },
    );
    return (
      <ExpandableSection
        isExpanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        toggleText="Citations"
      >
        <Accordion>{citations}</Accordion>
      </ExpandableSection>
    );
  };

  return (
    <Page>
      <PageSection variant={
        isDarkMode ? PageSectionVariants.darker : PageSectionVariants.light
      }>
        <div class={isDarkMode ? 'pf-v5-theme-dark card-0-3-1' : 'card-0-3-1'}>
          <VirtualAssistant
            title="inScope AI Search"
            inputPlaceholder="Ask a question"
            message={userInputMessage}
            isSendButtonDisabled={loading}
            onChangeMessage={(_event, value) => {
              setUserInputMessage(value);
            }}
            onSendMessage={SendMessageHandler}
            actions={
              <React.Fragment>
                <VirtualAssistantAction
                  aria-label="Clear Conversation"
                  onClick={() => {
                    setConversation([]);
                  }}
                >
                  <TrashIcon />
                </VirtualAssistantAction>
              </React.Fragment>
            }
          >
            <AgentSelector />
            <br />
            <ConversationAlert title="AI will search documentation and then summarize and synthesize an answer.">
              Verify any information before taking action.
            </ConversationAlert>
            <Conversation />
            <ShowLoadingMessage />
            <ShowErrorMessage />
          </VirtualAssistant>
        </div>
      </PageSection>
    </Page>
  );
};
